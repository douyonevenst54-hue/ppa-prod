import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { AuthProvider } from "@/components/AuthProvider";
import PiBrowserBanner from "@/components/PiBrowserBanner";

export const metadata: Metadata = {
  title: "Pap-Pad-App",
  description: "Predict. Challenge. Earn.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script src="https://sdk.minepi.com/pi-sdk.js" async />
      </head>
      <body>
        <AuthProvider>
          <PiBrowserBanner>
            {children}
            <BottomNav />
          </PiBrowserBanner>
        </AuthProvider>
      </body>
    </html>
  );
}