import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PrivyAppProvider from "@/components/PrivyAppProvider";
import PageTransition from "@/components/PageTransition";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "VerBnb — AI-Enforced Marketplace Dispute Resolution",
  description:
    "Every dispute. Resolved by AI consensus. On-chain. Rental, marketplace, sourcing and delivery disputes settled by GenLayer validators.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* No-flash theme init: set .dark before first paint. Dark is the
            default — first-time visitors with no saved choice get dark; anyone
            who picked a theme keeps it. Inline + blocking to avoid flicker. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':true;document.documentElement.classList.toggle('dark',d);}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <PrivyAppProvider>
          <Navbar />
          <main>
            <PageTransition>{children}</PageTransition>
          </main>
          <Footer />
        </PrivyAppProvider>
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          theme="system"
          toastOptions={{ style: { borderRadius: "0.75rem" } }}
        />
      </body>
    </html>
  );
}
