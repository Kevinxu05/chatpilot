'use client';

import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: string;
  isUser: boolean;
}

export function ChatMessage({ message, isUser }: ChatMessageProps) {
  return (
    <div
      className={cn(
        'flex w-full mb-4',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-xs lg:max-w-md rounded-2xl border px-4 py-2.5',
          isUser
            ? 'border-blue-500/70 bg-blue-600/90 text-white rounded-br-none'
            : 'border-zinc-200/80 bg-white/80 text-zinc-900 rounded-bl-none'
        )}
      >
        <p className="text-sm leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
