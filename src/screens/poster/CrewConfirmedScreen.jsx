import React, { useState, useContext } from 'react';
import { Sparkles, Star, ShieldCheck, KeyRound, ArrowRight, ArrowLeft, Phone, Check, MapPin, Compass } from 'lucide-react';
import { AppContext } from '../../store/AppContext';
import { ToastContext } from '../../store/ToastContext';
import Tooltip from '../../components/Tooltip';
import MapView from '../../components/MapView';
import BirdAvatar from '../../components/BirdAvatars';
import { api } from '../../services/api';
import { SKILLS } from '../../config/constants';

const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.863-9.864.002-2.637-1.03-5.114-2.905-6.989-1.875-1.875-4.36-2.907-7.003-2.907-5.439 0-9.867 4.42-9.87 9.867-.001 1.737.457 3.432 1.328 4.935L1.077 21.65l4.89-1.28c.414-.14.415-.14.68-.016zM17.47 14.397c-.3-.149-1.772-.874-2.042-.972-.27-.099-.467-.149-.662.149-.195.298-.754.943-.925 1.141-.17.199-.34.224-.64.075-.3-.15-1.266-.467-2.41-1.485-.89-.795-1.49-1.777-1.665-2.076-.17-.3-.018-.462.13-.61.135-.133.3-.349.45-.523.15-.174.2-.298.3-.497.099-.198.05-.372-.025-.521-.075-.149-.662-1.596-.908-2.186-.24-.576-.484-.497-.662-.506-.17-.008-.367-.01-.563-.01-.196 0-.517.074-.787.373-.27.299-1.03 1.007-1.03 2.457s1.042 2.846 1.187 3.045c.145.199 2.053 3.134 4.975 4.393.695.3 1.237.479 1.662.614.698.222 1.334.191 1.837.116.56-.083 1.773-.725 2.023-1.425.25-.7.25-1.293.175-1.425-.075-.132-.27-.212-.57-.361z"/>
  </svg>
);

const CrewConfirmedScreen = () => {
  const { 
    currentPostedJob, 
    setCurrentPostedJob,
    setJobs,
    crewTaskers, 
    otpGenerated, 
    pushScreen, 
    popScreen,
    trackingTaskerPos, 
    userId
  } = useContext(AppContext);
  const { showToast } = useContext(ToastContext);
  
  const [otpVisible, setOtpVisible] = useState(false);
  const [paymentOption, setPaymentOption] = useState('online'); // 'online' or 'offline'
  const [paymentInitiated, setPaymentInitiated] = useState(() => {
    return localStorage.getItem(`payment_initiated_${currentPostedJob?.id}`) === 'true';
  });
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handlePayOnline = () => {
    const tasker = crewTaskers[0];
    const taskerUpi = tasker?.upiId || 'helphive@upi';
    const amount = currentPostedJob?.amount || 0;
    const taskTitle = currentPostedJob?.description || 'Task';
    
    // Construct UPI Deep Link
    const upiLink = `upi://pay?pa=${taskerUpi}&pn=${encodeURIComponent(tasker?.name || 'Helper')}&am=${amount}&cu=INR&tn=${encodeURIComponent('HelpHive Task: ' + taskTitle.substring(0, 20))}`;
    
    // Save to localStorage
    if (currentPostedJob?.id) {
      localStorage.setItem(`payment_initiated_${currentPostedJob.id}`, 'true');
    }
    setPaymentInitiated(true);

    // Open link
    window.location.href = upiLink;
  };

  const handleCompleteTask = async () => {
    setShowConfirmModal(false);
    if (!currentPostedJob) return;

    const jobId = currentPostedJob.id;
    
    // Optimistic UI updates
    setJobs(prevJobs => 
      prevJobs.map(j => j.id === jobId ? { ...j, status: 'completed' } : j)
    );
    setCurrentPostedJob(prev => prev ? { ...prev, status: 'completed' } : null);

    // Database update
    await api.updateJob(jobId, { status: 'completed' });

    // Clean up local storage
    localStorage.removeItem(`payment_initiated_${jobId}`);

    // Navigate to feedback rating screen
    pushScreen('rating_screen', true);
  };

  const handleWhatsAppSupport = () => {
    const skill = SKILLS.find(s => s.id === currentPostedJob?.skillId);
    const taskTitle = skill?.label || 'General Task';
    
    const message = `Hi HelpHive Support,\n\nI need help with a task.\n\nTask ID: ${currentPostedJob?.id || 'N/A'}\nTask Title: ${taskTitle}\nAmount: ₹${currentPostedJob?.amount || 0}\nStatus: ${currentPostedJob?.status || 'N/A'}\n\nHirer ID: ${currentPostedJob?.posterId || userId || 'N/A'}\nTasker ID: ${crewTaskers[0]?.id || 'N/A'}\n\nIssue: `;

    const whatsappUrl = `https://wa.me/919347442426?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleWhatsAppHelper = () => {
    const tasker = crewTaskers[0];
    const taskTitle = currentPostedJob?.description || 'Task';
    const message = `Hi ${tasker?.name || 'Helper'},\n\nI'm contacting you regarding our HelpHive task.\n\nTask ID: ${currentPostedJob?.id || 'N/A'}\nTask: ${taskTitle}\n\nMessage: `;
    const taskerPhone = tasker?.phone;
    
    if (!taskerPhone) {
      showToast('Helper phone number is unavailable.', 'error');
      return;
    }

    let cleanPhone = taskerPhone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-white px-6 py-6 overflow-y-auto select-none">
      
      {/* Header */}
      <div className="relative text-center pb-3 border-b border-border shrink-0">
        <button 
          onClick={() => pushScreen('poster_home')} 
          className="absolute left-0 top-2 p-2 -ml-2 text-dark hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="inline-flex items-center space-x-1.5 text-[10px] font-black tracking-widest text-green-600 bg-green-50 px-2.5 py-1 rounded-full uppercase border border-green-200">
          <Sparkles className="w-3 h-3 text-green-600 animate-pulse" />
          <span>Crew Confirmed</span>
        </div>
        <h2 className="text-base font-extrabold text-dark mt-2">Your Crew is Set!</h2>
      </div>

      {/* Main Content scrollable container */}
      <div className="flex-1 space-y-4.5 my-4 max-w-sm lg:max-w-2xl lg:px-8 mx-auto w-full text-left">
        
        {/* Real-time Tracking Map */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-black uppercase text-gray-400">
            <span>Live Location</span>
            <span className="text-primary animate-pulse uppercase tracking-wider">
              Active
            </span>
          </div>

          <MapView 
            jobLocation={{ lat: currentPostedJob?.lat || 31.2560, lng: currentPostedJob?.lng || 75.7051 }}
            taskerLocation={trackingTaskerPos}
            taskerBirdName={crewTaskers[0]?.bird || 'falcon'}
            height="180px"
          />
        </div>

        {/* Crew List Card */}
        {crewTaskers.map((tasker) => (
          <div key={tasker.id} className="flex items-center justify-between bg-gray-50 border border-border p-4 rounded-2xl">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full border border-primary/20 overflow-hidden bg-orange-50 flex items-center justify-center shrink-0">
                <BirdAvatar birdName={tasker.bird || 'falcon'} size={48} />
              </div>
              <div>
                <h3 className="text-sm font-black text-dark leading-tight">{tasker.name}</h3>
                {tasker.rating ? (
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="flex items-center text-primary text-[11px] font-bold">
                      <Star className="w-3 h-3 fill-primary text-primary mr-0.5" />
                      <span>{tasker.rating}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-bold">
                      • {tasker.tasksCompleted} tasks completed
                    </span>
                  </div>
                ) : (
                  <div className="inline-flex items-center mt-1 text-[10px] font-black tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase">
                    New Helper
                  </div>
                )}
              </div>
            </div>

            <Tooltip text="WhatsApp Helper">
              <button onClick={handleWhatsAppHelper} className="p-3 rounded-full bg-white border border-border text-green-600 hover:bg-green-50 hover:border-green-200 cursor-pointer transition-colors">
                <WhatsAppIcon className="w-4 h-4" />
              </button>
            </Tooltip>
          </div>
        ))}

        {/* OTP Section */}
        <div className="bg-orange-50/50 border border-primary/10 rounded-3xl p-5 space-y-3 text-center">
          <div className="flex items-center justify-center space-x-2 text-xs font-bold text-dark">
            <KeyRound className="w-4.5 h-4.5 text-primary" />
            <span>Secure Verification</span>
          </div>
          <p className="text-[10px] text-gray-500 font-semibold leading-normal max-w-[240px] mx-auto">
            Provide this code to your helper to authorize and start the job.
          </p>

          {otpVisible ? (
            <div className="bg-white border border-primary/20 rounded-2xl py-3 px-6 inline-block shadow-xs animate-scale-up">
              <span className="text-2xl font-black text-primary tracking-widest">{currentPostedJob?.otp || otpGenerated || '----'}</span>
            </div>
          ) : (
            <Tooltip text="Show verification OTP code">
              <button
                onClick={() => setOtpVisible(true)}
                className="bg-primary hover:bg-primary/95 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-xs cursor-pointer inline-flex items-center space-x-1.5 transition-all"
              >
                <span>Reveal OTP</span>
              </button>
            </Tooltip>
          )}
        </div>

        {/* Payment Options */}
        <div className="bg-gray-50 border border-border rounded-2xl p-5 space-y-4">
          <label className="block text-[11px] font-black uppercase tracking-wider text-gray-400">
            Payment Method
          </label>
          
          <div className="space-y-2.5">
            {/* Pay Online Card */}
            <button
              onClick={() => setPaymentOption('online')}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                paymentOption === 'online'
                  ? 'border-green-600 bg-green-50/30'
                  : 'border-border bg-white hover:bg-gray-50/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0 ${
                  paymentOption === 'online' ? 'border-green-600' : 'border-gray-300'
                }`}>
                  {paymentOption === 'online' && <div className="w-2.5 h-2.5 rounded-full bg-green-600" />}
                </div>
                <div>
                  <span className="text-xs font-black text-dark block">Pay Online</span>
                  <span className="text-[9px] font-bold text-gray-400 mt-0.5 block">Pay instantly using PhonePe, GPay, Paytm, etc.</span>
                </div>
              </div>
            </button>

            {/* Pay Offline Card */}
            <button
              onClick={() => setPaymentOption('offline')}
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                paymentOption === 'offline'
                  ? 'border-green-600 bg-green-50/30'
                  : 'border-border bg-white hover:bg-gray-50/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0 ${
                  paymentOption === 'offline' ? 'border-green-600' : 'border-gray-300'
                }`}>
                  {paymentOption === 'offline' && <div className="w-2.5 h-2.5 rounded-full bg-green-600" />}
                </div>
                <div>
                  <span className="text-xs font-black text-dark block">Pay Offline</span>
                  <span className="text-[9px] font-bold text-gray-400 mt-0.5 block">Pay cash directly or through other offline methods.</span>
                </div>
              </div>
            </button>
          </div>

          {/* Primary Action Button */}
          <div className="pt-2">
            {paymentOption === 'online' && !paymentInitiated ? (
              <Tooltip text={`Initiate payment of ₹${currentPostedJob?.amount || 0} via UPI`}>
                <button
                  onClick={handlePayOnline}
                  className="w-full flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-green-600/20 active:scale-[0.99] transition-all cursor-pointer text-center text-xs tracking-wide"
                >
                  Pay Online
                </button>
              </Tooltip>
            ) : (
              <Tooltip text="Complete the task and submit helper review">
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="w-full flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-green-600/20 active:scale-[0.99] transition-all cursor-pointer text-center text-xs tracking-wide"
                >
                  I Have Paid
                </button>
              </Tooltip>
            )}
          </div>

          {/* Divider */}
          <hr className="border-border my-2" />

          {/* Need Help Section */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
              Need Help?
            </h4>
            <button
              onClick={handleWhatsAppSupport}
              className="flex items-center space-x-2 text-xs font-bold text-gray-500 hover:text-green-600 transition-colors cursor-pointer bg-white border border-border hover:border-green-200 hover:bg-green-50/10 px-4 py-3 rounded-xl w-full"
            >
              <WhatsAppIcon className="w-4 h-4 text-green-600 shrink-0" />
              <span>Support</span>
            </button>
          </div>

        </div>

      </div>

      {/* Confirm Payment Modal */}
      {showConfirmModal && (
        <div 
          onClick={() => setShowConfirmModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs transition-opacity duration-300"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-[90%] max-w-sm rounded-[32px] p-6 flex flex-col shadow-2xl scale-100 transition-transform duration-300"
          >
            <h3 className="text-base font-black text-dark text-center">Confirm Payment</h3>
            <p className="text-xs font-semibold text-gray-500 mt-3 text-center leading-relaxed">
              Have you completed the payment for this task?
            </p>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3.5 border border-border rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteTask}
                className="flex-1 py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-md shadow-green-600/20 cursor-pointer transition-all active:scale-[0.98]"
              >
                Complete Task
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CrewConfirmedScreen;
