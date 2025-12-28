import './globals.css';

export const metadata = {
  title: 'Options Analyzer | Premium Selling Returns',
  description: 'Analyze put and call options with normalized 30-day returns for premium selling strategies',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
