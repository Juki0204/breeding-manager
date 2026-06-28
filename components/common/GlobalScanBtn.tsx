import { BsUpcScan } from "react-icons/bs";

export default function GlobalNav() {
  return (
    <div className="flex flex-col items-center justify-center fixed bottom-18 right-2 w-16 pt-1 aspect-square rounded-full bg-neutral-700 text-white">
      <BsUpcScan className="text-3xl" />
      <span className="text-[10px]">OCR</span>
    </div>
  );
}
