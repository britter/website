import { motion } from "framer-motion";

export default function SuccessMessage() {
  return (
    <motion.div
      className="flex flex-col items-center justify-center space-y-2"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="w-16 h-16 flex items-center justify-center rounded-full bg-green-500"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-10 h-10 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </motion.div>
      <p className="text-lg font-medium text-gray-700">Message Sent!</p>
    </motion.div>
  );
}
