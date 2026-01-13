'use client';

import { useEffect } from 'react';

/**
 * Component that pings the backend health endpoint every 14 minutes
 * to prevent Render backend from sleeping
 */
export function HealthPing() {
  useEffect(() => {
    // Get the base API URL and construct health endpoint URL
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    // Health endpoint is at /api/health
    const healthUrl = `${apiBaseUrl}/health`;

    // Ping health endpoint immediately on mount
    const pingHealth = async () => {
      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        // Health check successful - server is awake
        // We don't need to handle the response, just the fact that the request completed
      } catch (error) {
        // Silently fail - we don't want to spam the console
        // The ping is just to keep the server awake, so failures are acceptable
        // Network errors or CORS issues won't prevent future pings
      }
    };

    // Ping immediately
    pingHealth();

    // Set up interval to ping every 14 minutes (840000 milliseconds)
    const interval = setInterval(() => {
      pingHealth();
    }, 14 * 60 * 1000); // 14 minutes

    // Cleanup interval on unmount
    return () => {
      clearInterval(interval);
    };
  }, []);

  // This component doesn't render anything
  return null;
}
