"use client";

import { useEffect, useRef, useCallback } from "react";
import { getTerminalWsUrl } from "@/lib/api";

interface TerminalProps {
  projectName: string;
}

export default function Terminal({ projectName }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<any>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(
    async (term: any) => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const url = getTerminalWsUrl(projectName);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        term.writeln("\r\n\x1b[32mConnected to server.\x1b[0m\r\n");
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        term.write(event.data);
      };

      ws.onclose = () => {
        term.writeln("\r\n\x1b[33mDisconnected. Reconnecting in 3s...\x1b[0m");
        reconnectTimerRef.current = setTimeout(() => {
          if (termRef.current) {
            connect(termRef.current);
          }
        }, 3000);
      };

      ws.onerror = () => {
        // onclose will fire after this
      };

      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });
    },
    [projectName]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;

    async function init() {
      const { Terminal: XTerminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      const { WebLinksAddon } = await import("@xterm/addon-web-links");

      if (disposed) return;

      const term = new XTerminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        theme: {
          background: "#1a1a2e",
          foreground: "#e0e0e0",
          cursor: "#e0e0e0",
          selectionBackground: "#3a3a5e",
          black: "#1a1a2e",
          red: "#ff6b6b",
          green: "#51cf66",
          yellow: "#ffd43b",
          blue: "#74c0fc",
          magenta: "#da77f2",
          cyan: "#66d9e8",
          white: "#e0e0e0",
          brightBlack: "#4a4a6e",
          brightRed: "#ff8787",
          brightGreen: "#69db7c",
          brightYellow: "#ffe066",
          brightBlue: "#91d5ff",
          brightMagenta: "#e599f7",
          brightCyan: "#99e9f2",
          brightWhite: "#ffffff",
        },
        scrollback: 5000,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);

      if (containerRef.current) {
        term.open(containerRef.current);
        fitAddon.fit();
      }

      // Send resize events to the server
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      });

      termRef.current = term;
      fitAddonRef.current = fitAddon;

      connect(term);
    }

    init();

    const handleResize = () => {
      if (fitAddonRef.current) {
        try {
          fitAddonRef.current.fit();
        } catch {
          // container might not be visible
        }
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", handleResize);

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
      }
    };
  }, [projectName, connect]);

  return (
    <div className="flex-1 min-w-[400px] flex flex-col bg-[#1a1a2e]">
      <div className="flex items-center px-4 py-2 bg-[#16163a] border-b border-[#2a2a4e]">
        <div className="flex items-center gap-1.5 mr-3">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="text-xs text-gray-400 font-mono">
          {projectName} — terminal
        </span>
      </div>
      <div ref={containerRef} className="flex-1 p-1" />
    </div>
  );
}
