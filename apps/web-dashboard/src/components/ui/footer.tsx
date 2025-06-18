import React from "react";

interface FooterProps {
  className?: string;
  content?: React.ReactNode;
}

export function Footer({ className = "", content }: FooterProps) {
  return (
    <footer
      className={`w-full flex items-center justify-center h-14 px-4 shadow-inner bg-white text-gray-600 text-sm ${className}`}
      style={{ position: "fixed", bottom: 0, left: 0, zIndex: 50 }}
    >
      {content || (
        <span>
          &copy; {new Date().getFullYear()} Municipal Dashboard. All rights
          reserved.
        </span>
      )}
    </footer>
  );
}
