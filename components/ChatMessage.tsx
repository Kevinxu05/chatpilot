'use client';

/* eslint-disable @next/next/no-img-element */

import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: string;
  isUser: boolean;
  imageUrl?: string;
}

export function ChatMessage({ message, isUser, imageUrl }: ChatMessageProps) {
  return (
    <div
      className={cn(
        'flex w-full mb-4',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-xs lg:max-w-md overflow-hidden rounded-2xl border px-4 py-2.5',
          isUser
            ? 'border-blue-500/70 bg-blue-600/90 text-white rounded-br-none'
            : 'border-zinc-200/80 bg-white/80 text-zinc-900 rounded-bl-none'
        )}
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Uploaded image"
            className="mb-2 max-h-60 w-full rounded-xl object-contain border border-zinc-200/60"
          />
        )}
        <p className="text-sm leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
