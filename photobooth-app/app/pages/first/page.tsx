"use client";

import Link from "next/link";

export default function First() {
  return (
    <div className="bg-white min-h-screen flex items-center justify-center px-6 relative overflow-hidden">
      <div className="flex flex-col items-center text-center">
        <h1 className="text-5xl font-bold mb-3">LITRATO.</h1>
        <p className="text-lg text-gray-600 mb-8">Bring photobooth at home.</p>

        <Link
          href="/pages/second"
          className="bg-red-600 text-white px-8 py-3 rounded-full text-lg font-semibold shadow-lg hover:bg-red-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-300"
        >
          Take a Photo
        </Link>
      </div>
    </div>
  );
}