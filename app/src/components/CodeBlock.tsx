import { motion, AnimatePresence } from "framer-motion";
import { PolygonGenerator } from "diet-sprite";
import { useMemo, useEffect, useRef } from "react";
import beautify from "js-beautify";

declare global {
  interface Window {
    Prism: any;
  }
}

interface CodeBlockProps {
  isOpen: boolean;
  polygon: PolygonGenerator;
  onClose: () => void;
}

export function CodeBlock({ isOpen, polygon, onClose }: CodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null);

  const codeContent = useMemo(() => {
    if (!isOpen) return "";

    const positions = Array.from(polygon.positions);
    const indices = Array.from(polygon.index);
    const uvs = Array.from(polygon.uv);

    const rawCode = `// Generated geometry arrays
const positions = new Float32Array([
${positions.join(", ")}]);

const uvs = new Float32Array([
${uvs.join(",")}]);

const indices = new Uint16Array([${indices.join(", ")}]);

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
geometry.setIndex(new THREE.BufferAttribute(indices, 1));
geometry.computeVertexNormals();`;

    return beautify(rawCode, {
      indent_size: 2,
      space_in_empty_paren: false,
      jslint_happy: false,
      brace_style: "collapse",
      break_chained_methods: false,
      wrap_line_length: 80,
    });
  }, [isOpen, polygon]);

  useEffect(() => {
    if (isOpen && codeRef.current && window.Prism) {
      window.Prism.highlightElement(codeRef.current);
    }
  }, [isOpen, codeContent]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-100"
            onClick={onClose}
          />

          {/* Code Block */}
          <motion.div
            initial={{ x: -700 }}
            animate={{ x: 0 }}
            exit={{ x: -700 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed left-0 top-0 bottom-0 w-[700px] bg-[#0C1116] border-r border-[#30363d] shadow-2xl z-101 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 shrink-0">
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors text-sm leading-none cursor-pointer opacity-50 hover:opacity-100"
              >
                ✕
              </button>

              {/* Copy button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(codeContent);
                }}
                className=" right-6 px-3 py-1.5  text-white text-sm rounded transition-colors cursor-pointer opacity-50 hover:opacity-100"
              >
                Copy
              </button>
            </div>

            {/* Code Content */}
            <div
              className="overflow-auto flex-1 p-6 code-scroll"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "rgb(255,26,125) #0d1117",
              }}
            >
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                .code-scroll::-webkit-scrollbar {
                  width: 8px;
                  height: 8px;
                }
                .code-scroll::-webkit-scrollbar-track {
                  background: #0d1117;
                }
                .code-scroll::-webkit-scrollbar-thumb {
                  background: rgb(255,26,125);
                  border-radius: 4px;
                }
                .code-scroll::-webkit-scrollbar-thumb:hover {
                  background: rgb(255,50,150);
                }
              `,
                }}
              />
              <pre className="text-[8px] font-mono leading-relaxed bg-transparent! m-0! p-0!">
                <code
                  ref={codeRef}
                  className="language-typescript"
                  style={{
                    fontSize: "12px",
                  }}
                >
                  {codeContent}
                </code>
              </pre>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
