import React, { useContext, useState } from 'react';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { AppContext } from '../store/AppContext';
import { ToastContext } from '../store/ToastContext';

const NeedHelpScreen = () => {
  const { popScreen } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);
  const [issueDescription, setIssueDescription] = useState('');

  const handleSubmit = () => {
    if (!issueDescription.trim()) {
      showToast('Please describe your issue.', 'error');
      return;
    }

    // Mock storing the report in localStorage for later retrieval
    const existingReports = JSON.parse(localStorage.getItem('helpReports') || '[]');
    const newReport = {
      id: Date.now().toString(),
      description: issueDescription,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    localStorage.setItem('helpReports', JSON.stringify([...existingReports, newReport]));

    showToast('Your issue has been reported successfully.', 'success');
    popScreen();
  };

  return (
    <div className="flex-1 flex flex-col bg-white h-full relative z-20">
      {/* Header */}
      <div className="flex items-center px-4 py-4 border-b border-border bg-white sticky top-0 z-10 shrink-0">
        <button 
          onClick={popScreen}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-dark transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-black text-dark ml-2">Need Help?</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8 pb-28 space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <HelpCircle className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-xl font-black text-dark mb-2">How can we assist you?</h3>
          <p className="text-sm font-semibold text-gray-500">
            Describe your issue below, and our support team will review it.
          </p>
        </div>

        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Issue Description</label>
          <textarea 
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            rows={6}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-dark focus:outline-none focus:border-primary focus:bg-white transition-colors resize-none"
            placeholder="Tell us what went wrong or how we can help..."
          />
        </div>
      </div>

      {/* Sticky Bottom CTA */}
      <div className="absolute bottom-6 left-0 right-0 px-6 z-20">
        <button 
          onClick={handleSubmit}
          className="w-full flex items-center justify-center bg-primary hover:bg-primary/95 text-white py-4 rounded-2xl shadow-lg font-black tracking-wide cursor-pointer active:scale-[0.99] transition-all"
        >
          Submit Report
        </button>
      </div>
    </div>
  );
};

export default NeedHelpScreen;
