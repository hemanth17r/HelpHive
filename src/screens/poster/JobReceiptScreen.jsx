import React, { useContext, useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle2, Receipt, MapPin, Users, Calendar, HelpCircle, FileText, Star, XCircle, AlertTriangle } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { SKILLS } from '../../config/constants';
import Tooltip from '../../components/Tooltip';
import { api } from '../../services/api';
import { formatCurrency } from '../../utils/currency';

const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.002-2.637-1.03-5.114-2.905-6.989-1.875-1.875-4.36-2.907-7.003-2.907-5.439 0-9.867 4.42-9.87 9.867-.001 1.737.457 3.432 1.328 4.935L1.077 21.65l4.89-1.28c.414-.14.415-.14.68-.016zM17.47 14.397c-.3-.149-1.772-.874-2.042-.972-.27-.099-.467-.149-.662.149-.195.298-.754.943-.925 1.141-.17.199-.34.224-.64.075-.3-.15-1.266-.467-2.41-1.485-.89-.795-1.49-1.777-1.665-2.076-.17-.3-.018-.462.13-.61.135-.133.3-.349.45-.523.15-.174.2-.298.3-.497.099-.198.05-.372-.025-.521-.075-.149-.662-1.596-.908-2.186-.24-.576-.484-.497-.662-.506-.17-.008-.367-.01-.563-.01-.196 0-.517.074-.787.373-.27.299-1.03 1.007-1.03 2.457s1.042 2.846 1.187 3.045c.145.199 2.053 3.134 4.975 4.393.695.3 1.237.479 1.662.614.698.222 1.334.191 1.837.116.56-.083 1.773-.725 2.023-1.425.25-.7.25-1.293.175-1.425-.075-.132-.27-.212-.57-.361z"/>
  </svg>
);

const JobReceiptScreen = () => {
  const { currentPostedJob, pushScreen, popScreen, userId, role, currency } = useContext(AppContext);
  const [crew, setCrew] = useState([]);
  
  useEffect(() => {
    if (currentPostedJob?.id) {
      api.fetchJobCrew(currentPostedJob.id).then(({ data }) => {
        if (data) setCrew(data);
      });
    }
  }, [currentPostedJob?.id]);
  
  if (!currentPostedJob) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white p-6">
        <p className="text-gray-500 font-bold">Task details not found.</p>
        <button onClick={() => pushScreen('poster_home')} className="mt-4 text-primary font-bold">Go Home</button>
      </div>
    );
  }

  const skill = SKILLS.find(s => s.id === currentPostedJob.skillId);
  const Icon = skill ? skill.icon : SKILLS[0].icon;

  const displayOrderId = currentPostedJob.id?.toString().length > 8 
    ? `#${currentPostedJob.id.toString().substring(0, 8).toUpperCase()}`
    : `#${currentPostedJob.id}`;
  
  // Format Date safely
  let formattedDate = 'Recent';
  try {
    if (currentPostedJob.timePosted) {
      const date = new Date(currentPostedJob.timePosted);
      formattedDate = date.toLocaleDateString('en-IN', { 
        day: 'numeric', month: 'short', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      });
    }
  } catch (e) {
    // Ignore formatting errors
  }

  const handleWhatsAppSupport = () => {
    const taskTitle = skill?.label || 'General Operation';
    const message = `Hi HelpHive Support,\n\nI need help with a completed contract.\n\nContract ID: ${currentPostedJob.id || 'N/A'}\nContract: ${taskTitle}\nAmount Settled: ${formatCurrency(currentPostedJob.amount || 0, currentPostedJob.currency || currency?.code)}\n\nFixer ID: ${currentPostedJob.posterId || userId || 'N/A'}\n\nIssue: `;
    const whatsappUrl = `https://wa.me/919347442426?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const isJobCancelled = currentPostedJob.status === 'cancelled' || currentPostedJob.isCancelledByMe;
  const cancelledHelpers = crew.filter(c => c.status === 'rejected');
  
  let cancelMessage = '';
  if (isJobCancelled) {
    if (role === 'tasker') {
      if (currentPostedJob.isCancelledByMe) {
        cancelMessage = "You disengaged from this contract.";
      } else {
        cancelMessage = "This contract was aborted by the Fixer.";
      }
    } else {
      if (cancelledHelpers.length > 0) {
        cancelMessage = `${cancelledHelpers.map(h => h.name).join(', ')} disengaged from this contract.`;
      } else {
        cancelMessage = "You aborted this contract.";
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white select-none">
      
      {/* Top Bar Navigation */}
      <div className="bg-white px-4 py-4 flex items-center shrink-0 sticky top-0 z-20">
        <Tooltip text="Go Back">
          <button onClick={popScreen} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-dark transition-colors cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </Tooltip>
        <h1 className="ml-2 text-base font-black text-dark tracking-tight">Contract Settlement Report</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-6 w-full max-w-md lg:max-w-2xl mx-auto">
        
        {/* Status Header */}
        {isJobCancelled ? (
          <div className="flex flex-col items-center justify-center space-y-3 py-4">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center border border-red-200 shadow-xs">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-dark">Contract Aborted</h2>
            <p className="text-xs font-bold text-gray-400 text-center max-w-xs">{cancelMessage}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-3 py-4">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center border border-green-200 shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-dark">Contract Fulfilled</h2>
            <p className="text-xs font-bold text-gray-400">Mission accomplished. Escrow settled.</p>
          </div>
        )}

        {/* Task Details Card */}
        <div className="bg-white border border-border rounded-3xl p-5 shadow-xs space-y-4 relative overflow-hidden">
          {/* Top category label */}
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-500 block leading-none mb-1">
                Operator Class
              </span>
              <span className="text-sm font-semibold text-dark capitalize">
                {skill?.label || 'General Operation'}
              </span>
            </div>
          </div>
          {currentPostedJob.description && (
            <div className="pt-2">
              <p className="text-xs font-bold text-dark leading-relaxed">
                {currentPostedJob.description}
              </p>
              {currentPostedJob.address?.completeAddress && (
                <div className="flex items-start mt-1.5 space-x-1">
                  <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-xs font-bold text-gray-500 leading-snug">
                    {currentPostedJob.address.completeAddress?.startsWith('Location at') && currentPostedJob.address.landmark 
                      ? currentPostedJob.address.landmark 
                      : currentPostedJob.address.completeAddress}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Order Info Card */}
        <div className="bg-white border border-border rounded-3xl p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-semibold text-gray-500 border-b border-gray-100 pb-3 flex items-center">
            <FileText className="w-4 h-4 mr-1.5" /> Contract Record
          </h3>
          
          <div className="space-y-3 pt-1">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2 text-gray-500">
                <Receipt className="w-4 h-4" />
                <span className="text-xs font-bold">Contract ID</span>
              </div>
              <span className="text-xs font-black text-dark text-right">
                {displayOrderId}
              </span>
            </div>

            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2 text-gray-500">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-bold">Execution Timestamp</span>
              </div>
              <span className="text-xs font-black text-dark text-right">
                {formattedDate}
              </span>
            </div>

            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2 text-gray-500">
                <Users className="w-4 h-4" />
                <span className="text-xs font-bold">Operators Deployed</span>
              </div>
              <span className="text-xs font-black text-dark text-right">
                {currentPostedJob.peopleNeeded}
              </span>
            </div>
          </div>
        </div>

        {/* Bill Summary */}
        {isJobCancelled && role === 'tasker' && currentPostedJob.isCancelledByMe ? (
          <div className="bg-white border border-border rounded-3xl p-5 shadow-xs">
             <h3 className="text-xs font-semibold text-gray-500 border-b border-gray-100 pb-3 mb-3">
               Bounty Settlement Breakdown
             </h3>
             <div className="flex flex-col items-center justify-center py-2 text-center">
               <XCircle className="w-8 h-8 text-red-500 mb-2" />
               <span className="text-xs font-bold text-gray-500">Aborted Assignment</span>
               <span className="text-[10px] text-gray-400 font-semibold mt-1">No bounty is due for aborted assignments.</span>
             </div>
          </div>
        ) : (
          <div className="bg-white border border-border rounded-3xl p-5 shadow-xs">
             <h3 className="text-xs font-semibold text-gray-500 border-b border-gray-100 pb-3 mb-3">
               Bounty Settlement Breakdown
             </h3>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-medium text-gray-500">Bounty per Operator</span>
                <span className="text-sm font-semibold text-dark">{formatCurrency(currentPostedJob.amount || 0, currentPostedJob.currency || currency?.code)}</span>
              </div>
              {role === 'poster' && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-medium text-gray-500">Operators Settled</span>
                  <span className="text-sm font-semibold text-dark">{crew.filter(c => c.status === 'accepted').length || 1}</span>
                </div>
              )}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <span className="text-sm font-semibold text-dark">Total Bounty Settled</span>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency((currentPostedJob.amount || 0) * (role === 'poster' ? (crew.filter(c => c.status === 'accepted').length || 1) : 1), currentPostedJob.currency || currency?.code)}
                </span>
              </div>
             <div className="mt-4 pt-3 border-t border-dashed border-gray-200 flex items-center justify-between">
               {isJobCancelled ? (
                 <div className="inline-flex items-center space-x-1.5 text-[10px] font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                    <XCircle className="w-3 h-3" />
                    <span>Aborted</span>
                  </div>
               ) : (
                 <div className="inline-flex items-center space-x-1.5 text-[10px] font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Settled</span>
                  </div>
               )}
             </div>
          </div>
        )}

        {/* Feedback Prompt */}
        {!currentPostedJob.hasBeenRated ? (
          <div className="bg-white border border-border rounded-3xl p-5 shadow-xs mb-6">
            <h3 className="text-xs font-semibold text-gray-500 border-b border-gray-100 pb-3 mb-3">
              Award Street Cred
            </h3>
            <div className="flex flex-col items-center justify-center text-center py-1 space-y-3">
              <p className="text-xs font-medium text-gray-500 leading-relaxed">
                Your commendations help maintain high standards in the open-world network.
              </p>
              <button
                onClick={() => pushScreen(role === 'poster' ? 'rating_screen' : 'tasker_rating')}
                className="flex items-center justify-center space-x-2 w-full bg-orange-50 hover:bg-orange-100 text-primary font-semibold py-3 rounded-xl border border-primary/20 active:scale-[0.99] transition-all cursor-pointer mt-2 text-xs"
              >
                <Star className="w-4 h-4 fill-primary/20" />
                <span>{role === 'poster' ? 'Commend Operator' : 'Rate Fixer Cred'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-border rounded-3xl p-5 shadow-xs mb-6">
            <h3 className="text-xs font-semibold text-gray-500 border-b border-gray-100 pb-3 mb-3">
              Your Commendation
            </h3>
            <div className="flex flex-col py-1 space-y-2">
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const ratingVal = currentPostedJob.myRatingToReceiver || 5;
                  return (
                    <Star 
                      key={star} 
                      className={`w-5 h-5 ${star <= ratingVal ? 'fill-primary text-primary' : 'text-gray-200'}`} 
                    />
                  );
                })}
                <span className="text-xs font-black text-dark ml-2">
                  {currentPostedJob.myRatingToReceiver ? currentPostedJob.myRatingToReceiver.toFixed(1) : '5.0'}
                </span>
              </div>
              <p className="text-xs font-semibold text-gray-500">
                You commended the {role === 'poster' ? 'Operator' : 'Fixer'} for this contract.
              </p>
            </div>
          </div>
        )}

        {/* Need Help Section */}
        <div className="bg-white border border-border rounded-3xl p-5 shadow-xs space-y-3 mb-8">
          <h4 className="text-xs font-semibold text-gray-500 flex items-center">
            <HelpCircle className="w-4 h-4 mr-1.5" /> Need help?
          </h4>
          <p className="text-xs font-semibold text-gray-500 leading-relaxed">
            Have an issue with this completed order? Our support team is here to help.
          </p>
          <button
            onClick={handleWhatsAppSupport}
            className="flex items-center justify-center space-x-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 active:scale-[0.98] transition-all cursor-pointer px-4 py-3.5 rounded-xl w-full shadow-md shadow-green-600/20 mt-2"
          >
            <WhatsAppIcon className="w-4 h-4 shrink-0" />
            <span>Chat with Support</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default JobReceiptScreen;
