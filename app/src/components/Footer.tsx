import { cx } from "class-variance-authority";
import { PolygonGenerator } from "diet-sprite";

interface FooterProps {
  isDragActive: boolean;
  uploadedImage: string | null;
  polygon: PolygonGenerator | null;
  onBackToExamples: () => void;
  onDownload: () => void;
  onShowCode: () => void;
}

export function Footer({
  isDragActive,
  uploadedImage,
  polygon,
  onBackToExamples,
  onDownload,
  onShowCode,
}: FooterProps) {
  return (
    <div
      id="footer"
      className={cx(
        "absolute bottom-[40px] left-[90px] right-[90px] transition-all duration-300 ease-in-out flex justify-between",
        isDragActive && "opacity-10"
      )}
    >
      <div className="text-white text-[11px]">@ggsimm</div>

      <div className="text-white text-[11px] flex gap-4 items-center z-10">
        {uploadedImage && (
          <span
            className="cursor-pointer hover:text-[rgb(255,26,125)] transition-colors"
            onClick={onBackToExamples}
          >
            ← Back to examples
          </span>
        )}
        {uploadedImage && polygon && (
          <>
            <span
              className="cursor-pointer hover:text-[rgb(255,26,125)] transition-colors"
              onClick={onShowCode}
            >
              [ Show Code ]
            </span>
            <span
              className="cursor-pointer hover:text-[rgb(255,26,125)] transition-colors"
              onClick={onDownload}
            >
              [ Download as GLTF ↓ ]
            </span>
          </>
        )}
        {!uploadedImage && (
          <span>Click on an example or drag and drop an image to generate.</span>
        )}
      </div>
    </div>
  );
}

