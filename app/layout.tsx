import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import { ThemeProvider } from '@/contexts/ThemeContext';

export const metadata: Metadata = {
  title: 'Joyspoon Ads Analytics 2.0',
  description: 'Multi-platform advertising analytics dashboard',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-64 p-8 animate-fade-in">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
