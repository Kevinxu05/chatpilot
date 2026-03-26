'use client';

/* eslint-disable @next/next/no-img-element */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChatMessage } from './ChatMessage';
import { Send, Image as ImageIcon } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  imageUrl?: string; // data URL for local preview + API payload
  promptText?: string; // text part to send to the model (may differ from display text)
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
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() && !imageDataUrl) return;

    // Add user message
    const trimmed = input.trim();
    const displayText = trimmed ? trimmed : '已发送图片';
    const promptText = trimmed ? trimmed : '请分析该图片。';
    const userMessage: Message = {
      id: Date.now().toString(),
      text: displayText,
      isUser: true,
      imageUrl: imageDataUrl || undefined,
      promptText,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setImageDataUrl(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsLoading(true);

    try {
      // Call OpenAI API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages.map((msg) => {
            const role = msg.isUser ? 'user' : 'assistant';
            if (msg.imageUrl) {
              return {
                role,
                content: [
                  { type: 'text', text: msg.promptText ?? msg.text },
                  {
                    type: 'image_url',
                    image_url: { url: msg.imageUrl },
                  },
                ],
              };
            }
            return { role, content: msg.text };
          }),
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
              imageUrl={message.imageUrl}
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const result = typeof reader.result === 'string' ? reader.result : null;
                setImageDataUrl(result);
                setImagePreviewUrl(result);
              };
              reader.readAsDataURL(file);
            }}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isLoading}
            className="rounded-full text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="h-4 w-4" />
            <span className="sr-only">Upload image</span>
          </Button>

          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入你的消息..."
            disabled={isLoading}
            className="flex-1 border-0 bg-transparent px-1 py-0 text-zinc-900 placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:border-transparent disabled:opacity-60"
          />

          {imagePreviewUrl && (
            <div className="mr-1 flex items-center gap-2">
              <img
                src={imagePreviewUrl}
                alt="Preview"
                className="h-8 w-8 rounded-lg border border-zinc-200/70 object-cover"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isLoading}
                className="h-7 w-7 rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                onClick={() => {
                  setImageDataUrl(null);
                  setImagePreviewUrl(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                <span className="text-base leading-none">×</span>
                <span className="sr-only">Remove image</span>
              </Button>
            </div>
          )}

          <Button
            type="submit"
            variant="ghost"
            size="icon"
            disabled={isLoading || (!input.trim() && !imageDataUrl)}
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
