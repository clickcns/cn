import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** 글을 클립보드에 복사한다. 누르면 잠깐 "복사됨"이 된다. */
export function CopyButton({
  text,
  label,
  idleText = "복사",
}: {
  text: string;
  /** 화면 읽기 이름: "{label} 복사" */
  label: string;
  idleText?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("복사하지 못했습니다. 글을 길게 눌러 복사해 주세요");
    }
  };
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`${label} 복사`}
      onClick={() => void copy()}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "복사됨" : idleText}
    </Button>
  );
}
