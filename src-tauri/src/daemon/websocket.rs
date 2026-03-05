use std::sync::Arc;

use futures_util::StreamExt;
use serde::Deserialize;
use tokio::net::TcpListener;
use tokio_tungstenite::accept_async;

use super::DaemonState;

#[derive(Deserialize)]
struct BrowserMessage {
    #[serde(rename = "type")]
    msg_type: String,
    url: Option<String>,
    #[allow(dead_code)]
    title: Option<String>,
    #[allow(dead_code)]
    timestamp: Option<String>,
}

pub async fn serve(state: Arc<DaemonState>) {
    let addr = "127.0.0.1:19876";
    let listener = match TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            log::error!("Failed to bind WebSocket server on {}: {}", addr, e);
            return;
        }
    };

    log::info!("WebSocket server listening on {}", addr);

    while let Ok((stream, addr)) = listener.accept().await {
        log::info!("New WebSocket connection from {}", addr);
        let conn_state = state.clone();
        tokio::spawn(async move {
            handle_connection(conn_state, stream).await;
        });
    }
}

async fn handle_connection(state: Arc<DaemonState>, stream: tokio::net::TcpStream) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            log::error!("WebSocket handshake failed: {}", e);
            return;
        }
    };

    let (_, mut read) = ws_stream.split();

    while let Some(Ok(msg)) = read.next().await {
        if let Ok(text) = msg.to_text() {
            if let Ok(payload) = serde_json::from_str::<BrowserMessage>(text) {
                if payload.msg_type == "tab_update" {
                    if let Some(url) = &payload.url {
                        // Update current event's browser_url
                        if let Ok(Some(current)) = state.db.get_current_event() {
                            state.db.update_event_url(current.id, url).ok();
                            log::debug!("Updated browser URL for event {}: {}", current.id, url);
                        }
                    }
                }
            }
        }
    }
}
