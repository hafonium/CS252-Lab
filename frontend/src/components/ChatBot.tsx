import { useState, useRef, useEffect } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SearchResult {
  name: string;
  type: string;
  lat: number;
  lng: number;
  description: string;
}

interface ChatBotProps {
  onSearchResults?: (results: SearchResult[], lat: number, lng: number) => void;
  currentCenter?: [number, number];
}

const BACKEND_API_BASE = import.meta.env.VITE_BACKEND_API_BASE || "http://127.0.0.1:8000";

export default function ChatBot({ onSearchResults, currentCenter }: ChatBotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: 'Xin chào! Tôi có thể giúp bạn tìm địa điểm. Ví dụ: "Tìm quán cơm tấm trong 10km" hoặc "Mình đang ở HCMUS, tìm quán cafe gần đây" hoặc "Tìm địa điểm gần địa chỉ hiện tại"',
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get user's actual device location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          console.log("User location:", position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn("Could not get user location:", error);
          // Fall back to currentCenter if geolocation fails
          setUserLocation(currentCenter || null);
        }
      );
    } else {
      // Fall back to currentCenter if geolocation not supported
      setUserLocation(currentCenter || null);
    }
  }, [currentCenter]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    // Add user message to chat
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      // Use actual user location if available, otherwise fall back to map center
      const locationToUse = userLocation || currentCenter;
      
      const response = await fetch(`${BACKEND_API_BASE}/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_history: messages,
          current_lat: locationToUse ? locationToUse[0] : null,
          current_lng: locationToUse ? locationToUse[1] : null,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Add assistant response
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);

      // If we have search results, pass them to parent component
      if (data.search_results && data.search_results.length > 0 && onSearchResults) {
        const extractedEntities = data.extracted_entities;
        if (extractedEntities && extractedEntities.lat && extractedEntities.lng) {
          onSearchResults(
            data.search_results,
            extractedEntities.lat,
            extractedEntities.lng
          );
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại sau.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chatbot-container">
      {/* Chat Toggle Button */}
      <button
        className="chat-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="AI Chatbot"
      >
        {isOpen ? "✕" : "💬"}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chat-window">
          <div className="chat-header">
            <h3 className="chat-name">Jipi-chan</h3>
          </div>

          <div className="chat-messages">
            {messages.map((msg, index) => (
              <div key={index} className={`chat-message ${msg.role}`}>
                {msg.role === "assistant" && (
                  <img className="message-avatar" src={"./src/assets/chat-avatar.png"} alt="Jipi-chan" />
                )}
                <div className="message-content">{msg.content}</div>
                {/* {msg.role === "user" && (
                  <div className="message-avatar">👤</div>
                )} */}
              </div>
            ))}
            {isLoading && (
              <div className="chat-message assistant">
                <img className="chat-avatar" src={"./src/assets/chat-avatar.png"} alt="Jipi-chan" />
                <div className="message-content typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="chat-input-form">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Nhập tin nhắn..."
              className="chat-input"
              disabled={isLoading}
            />
            <button
              type="submit"
              className="chat-send-btn"
              disabled={isLoading || !inputValue.trim()}
            >
              ➤
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
