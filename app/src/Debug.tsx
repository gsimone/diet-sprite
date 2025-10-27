import { useState, useRef } from "react";
import { PolygonGenerator } from "diet-sprite";
import { useDropzone } from "react-dropzone";
import { cx } from "class-variance-authority";

import logo from "../assets/dietsprite.svg";
import { downloadGLTF } from "./utils";

import { UploadedImageDebugCanvasWithControls } from "./components/UploadedImageDebugCanvas";
import { DebugExamples } from "./components/DebugExamples";
import { DebugDropzone } from "./components/DebugDropzone";
import { Footer } from "./components/Footer";
import { CodeBlock } from "./components/CodeBlock";

function Debug() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [polygon, setPolygon] = useState<PolygonGenerator | null>(null);
  const [showCode, setShowCode] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedImage(reader.result as string);
        setPolygon(null); // Reset polygon when new image is uploaded
        // Scroll to top when new image is uploaded
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = () => {
    if (polygon) {
      downloadGLTF(polygon, "sprite.gltf");
    }
  };

  const handlePolygonGenerated = (
    poly: PolygonGenerator | null,
    _params: {
      vertices: number;
      threshold: number;
      gridSize: number;
      animate: boolean;
      fps: number;
    }
  ) => {
    setPolygon(poly);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
    },
    multiple: false,
    noKeyboard: true,
    disabled: !!uploadedImage,
  });

  return (
    <div
      className={cx(
        "w-screen h-screen m-0 p-0 bg-[#0C1116]",
        "overflow-hidden"
      )}
      {...(uploadedImage ? {} : getRootProps())}
      ref={scrollContainerRef}
    >
      <div className="fixed left-[90px] top-[60px] text-[rgb(255,26,125)] font-bold z-50">
        <img src={logo} alt="logo" className="w-full h-full" />
      </div>

      <Footer
        isDragActive={isDragActive}
        uploadedImage={uploadedImage}
        polygon={polygon}
        onBackToExamples={() => setUploadedImage(null)}
        onDownload={handleDownload}
        onShowCode={() => setShowCode(true)}
      />

      {polygon && (
        <CodeBlock
          isOpen={showCode}
          polygon={polygon}
          onClose={() => setShowCode(false)}
        />
      )}

      {!uploadedImage && (
        <>
          <div
            className={cx(
              "transition-all duration-300 ease-in-out h-screen flex items-center justify-center",
              isDragActive && "opacity-20"
            )}
          >
            <DebugExamples onExampleClick={setUploadedImage} />
            <input {...getInputProps()} />
          </div>

          <DebugDropzone isDragActive={isDragActive} />
        </>
      )}

      {uploadedImage && (
        <div className="relative">
          {/* First section: Debug Canvas */}
          <div className="h-screen flex items-center justify-center relative">
            <UploadedImageDebugCanvasWithControls
              uploadedImage={uploadedImage}
              onClearImage={() => setUploadedImage(null)}
              onPolygonGenerated={handlePolygonGenerated}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default Debug;
