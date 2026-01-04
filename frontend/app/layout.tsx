import './globals.css';
import React from 'react';

export const metadata = {
  title: 'automanim',
  description: 'Chat to generate and preview Manim scenes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
