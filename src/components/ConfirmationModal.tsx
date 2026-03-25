import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-white w-full rounded-[2rem] p-6 shadow-2xl animate-in zoom-in">
        <h3 className="text-xl font-black text-center mb-2">{title}</h3>
        <p className="text-gray-500 text-center mb-6">{message}</p>
        <div className="flex flex-col gap-2">
          <button 
            onClick={onConfirm}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100"
          >
            تأكيد
          </button>
          <button 
            onClick={onCancel}
            className="w-full py-4 text-gray-400 font-bold"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
