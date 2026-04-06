'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-lg shadow-primary-500/50 flex items-center justify-center transition-all hover:scale-110"
        aria-label="Open chat"
      >
        {!isOpen ? (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 h-[500px] bg-white rounded-xl shadow-2xl border border-secondary-200 flex flex-col">
          {/* Chat Header */}
          <div className="bg-primary-600 text-white p-4 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-lg font-bold">G</span>
              </div>
              <div>
                <h3 className="font-semibold">Godroox Support</h3>
                <p className="text-xs text-primary-100">We're here to help</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-primary-100"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            <div className="flex items-start space-x-2">
              <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary-600">G</span>
              </div>
              <div className="bg-secondary-100 rounded-lg p-3 max-w-[80%]">
                <p className="text-sm text-secondary-900">
                  Hello! How can we help you today?
                </p>
              </div>
            </div>
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t border-secondary-200">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Type your message..."
                className="flex-1 h-10 px-4 rounded-lg border border-secondary-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <Button size="sm" className="bg-primary-600 hover:bg-primary-700 text-white">
                Send
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
