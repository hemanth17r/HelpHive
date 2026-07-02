import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 bg-light-gray text-center w-full min-h-[50vh]">
          <div className="p-4 bg-red-50 rounded-full text-red-500 mb-4">
            <AlertTriangle className="w-12 h-12" />
          </div>
          <h2 className="text-lg font-black text-dark mb-2">Something went wrong.</h2>
          <p className="text-sm font-semibold text-gray-500 mb-6 max-w-sm">
            We encountered an unexpected error displaying this screen.
          </p>
          
          <div className="flex flex-col space-y-2 w-full max-w-xs">
            <button 
              onClick={this.handleRetry}
              className="flex items-center justify-center space-x-2 bg-primary text-white px-6 py-3 rounded-xl font-bold shadow-sm hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          </div>

          {import.meta.env.DEV && this.state.error && (
            <div className="mt-8 text-left bg-red-50 p-4 rounded-xl border border-red-100 overflow-auto w-full text-xs max-w-lg">
              <p className="font-bold text-red-800 mb-2">{this.state.error.toString()}</p>
              <pre className="text-red-600/80 whitespace-pre-wrap break-words">{this.state.errorInfo?.componentStack}</pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;

