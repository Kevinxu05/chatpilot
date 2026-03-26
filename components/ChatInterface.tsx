'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ChatMessage } from './ChatMessage';
import { Send } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: '你好！请告诉我你想分析的聊天内容。',
      isUser: false,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      isUser: true,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Call OpenAI API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages.map((msg) => ({
            role: msg.isUser ? 'user' : 'assistant',
            content: msg.text,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const data = await response.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.content,
        isUser: false,
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        isUser: false,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-sm font-semibold text-zinc-900">
          聊天情感分析
        </h1>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="mx-auto max-w-xl space-y-4">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message.text}
              isUser={message.isUser}
            />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-3 backdrop-blur">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce delay-100" />
                  <div className="w-2 h-2 rounded-full bg-zinc-500 animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="p-6 pb-10">
        <form
          onSubmit={handleSendMessage}
          className="mx-auto flex max-w-xl items-center gap-2 rounded-full border border-zinc-200/80 bg-white/80 px-4 py-2 backdrop-blur shadow-sm"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的消息..."
            disabled={isLoading}
            className="flex-1 border-0 bg-transparent px-1 py-0 text-zinc-900 placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:border-transparent disabled:opacity-60"
          />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="rounded-full text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
