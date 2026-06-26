import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PrivyAppProvider from "@/components/PrivyAppProvider";

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
    <html lang="en">
      <body className="font-sans antialiased">
        <PrivyAppProvider>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </PrivyAppProvider>
      </body>
    </html>
  );
}
