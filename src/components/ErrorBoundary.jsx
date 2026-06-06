import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 bg-light-gray text-center w-full min-h-[50vh]">
          <div className="p-4 bg-red-50 rounded-full text-red-500 mb-4">
            <AlertTriangle className="w-12 h-12" />
          </div>
          <h2 className="text-lg font-black text-dark mb-2">Something went wrong.</h2>
          <p className="text-sm font-semibold text-gray-500 mb-6 max-w-sm">
            We encountered an unexpected error displaying this screen. Our team has been notified.
          </p>
          
          <button 
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            className="flex items-center space-x-2 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-sm hover:bg-primary-dark transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reload Application</span>
          </button>

          {process.env.NODE_ENV !== 'production' && this.state.error && (
            <div className="mt-8 text-left bg-red-50 p-4 rounded-xl border border-red-100 overflow-auto w-full text-xs">
              <p className="font-bold text-red-800 mb-2">{this.state.error.toString()}</p>
              <pre className="text-red-600/80">{this.state.errorInfo?.componentStack}</pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
