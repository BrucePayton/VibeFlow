import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '../types';

interface ChatMessageBubbleProps {
  message: ChatMessage;
}

const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
        <div className="flex justify-center my-4">
            <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-4 py-2 rounded-lg text-xs font-semibold shadow-sm flex items-center gap-2">
               {message.content}
            </div>
        </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 group`}>
        {!isUser && (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs shadow-md mr-3 mt-1 shrink-0">
                AI
            </div>
        )}
        
        <div className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm shadow-sm ${
            isUser 
            ? 'bg-gray-900 text-white rounded-br-none shadow-md' 
            : 'bg-white border border-gray-100 text-gray-700 rounded-bl-none'
        }`}>
            {/* 
              Tailwind Typography (prose) Configuration:
              - prose-sm: Optimizes typography for small text size
              - prose-invert: Colors for dark backgrounds (User bubble)
              - prose-stone: Colors for light backgrounds (AI bubble)
              - [&>*:first-child]:mt-0 / [&>*:last-child]:mb-0: Removes default vertical margins from the top/bottom elements for tight fit
            */}
            <div className={`prose prose-sm max-w-none break-words ${
                    isUser 
                    ? 'prose-invert prose-p:text-gray-100 prose-a:text-emerald-300' 
                    : 'prose-stone prose-p:text-gray-700 prose-a:text-emerald-600 prose-headings:text-gray-900'
                } [&>*:first-child]:mt-0 [&>*:last-child]:mb-0`}>
                <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                        a: ({node, ...props}) => (
                            <a {...props} target="_blank" rel="noopener noreferrer" className="underline decoration-emerald-400/50 hover:decoration-emerald-500 font-medium transition-colors" />
                        ),
                        code: ({node, className, children, ...props}) => {
                            const match = /language-(\w+)/.exec(className || '')
                            // Inline code vs Block code check (roughly)
                            const isBlock = match || (String(children).includes('\n'));
                            return !isBlock ? (
                                <code {...props} className={`${className} bg-black/10 px-1.5 py-0.5 rounded font-mono text-[0.9em]`}>
                                    {children}
                                </code>
                            ) : (
                                <code {...props} className={className}>
                                    {children}
                                </code>
                            )
                        }
                    }}
                >
                    {message.content}
                </ReactMarkdown>
            </div>
        </div>
    </div>
  );
};

export default ChatMessageBubble;