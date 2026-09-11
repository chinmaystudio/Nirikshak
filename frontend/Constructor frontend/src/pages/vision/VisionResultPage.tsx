import { Icon } from "@/components/common/Icon";
import { PageHeader } from "@/components/common/StatCard";
import { EmptyState } from "@/components/common/EmptyState";
import { VisionResultView } from "@/components/vision/VisionResultView";
import { useNavigate } from "@/app/router";
import { useInfrastructureVision } from "@/hooks/useInfrastructureVision";
import { toast } from "@/hooks/useToast";
import { latestResult } from "@/services/vision/visionService";
import { queueVisionReportPrefill } from "@/features/infrastructure-vision/visionFlow";
import { ROUTES } from "@/constants/routes";

export function VisionResultPage(): JSX.Element {
  const navigate = useNavigate();
  const id = window.location.hash.split("?")[0].split("/").pop() ?? "";
  const continueToReport = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("continue") === "report";
  const { getResult, submitInfo } = useInfrastructureVision();
  const result = id ? getResult(id) : latestResult();

  if (!result) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <PageHeader title="Infrastructure Result" back onBack={() => navigate(ROUTES.VISION)} />
        <div className="mt-5">
          <EmptyState
            icon="photo_camera"
            title="No analysis yet"
            text="Take or upload a photo of public infrastructure and Nirikshan Vision will identify it for you."
            ctaLabel="Identify Infrastructure"
            ctaRoute={ROUTES.VISION}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <button onClick={() => navigate(ROUTES.VISION)} className="inline-flex items-center gap-1.5 text-primary font-label-md font-bold hover:text-secondary">
        <Icon name="arrow_back" className="text-[20px]" /> Back to Identify
      </button>
      <VisionResultView
        result={result}
        continueToReport={continueToReport}
        onReport={() => {
          queueVisionReportPrefill(result);
          navigate(ROUTES.REPORT);
        }}
        onInfoSubmit={() => {
          submitInfo(result.id);
          toast("Thank you — this observation was recorded to improve Nirikshan's coverage.", "success");
        }}
        onAnalyzeAnother={() => navigate(ROUTES.VISION)}
      />
    </div>
  );
}
