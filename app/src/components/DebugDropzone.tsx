import { AnimatePresence, motion } from "framer-motion";
import { AnimatedBorder } from "./AnimatedBorder";

interface DebugDropzoneProps {
  isDragActive: boolean;
}

export function DebugDropzone({ isDragActive }: DebugDropzoneProps) {
  return (
    <AnimatePresence>
      {isDragActive && (
        <div className="shrink-0 fixed z-20 inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-4 bg-[rgba(255,26,125,0.1)] rounded-xl flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-white text-sm font-bold px-8"
            >
              Drop the image here to generate
            </motion.div>
          </div>
          <AnimatedBorder className="absolute inset-4 text-[rgb(255,26,125)] pointer-events-none" />
        </div>
      )}
    </AnimatePresence>
  );
}

