"use client";

import { BsUpcScan } from "react-icons/bs";
import { FaList, FaPlusCircle } from "react-icons/fa";
import { IoSettingsSharp } from "react-icons/io5";
import { TbWood } from "react-icons/tb";
import { PiBugBeetleFill } from "react-icons/pi";
import { FaVenusMars } from "react-icons/fa6";

import { useRouter } from "next/navigation";

export default function GlobalNav() {
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 w-full left-0 z-50">
      <ul className="flex">
        <li onClick={() => router.push("/")} className="flex flex-col gap-1 items-center justify-center flex-1 pt-2 pb-1 border-t border-r border-neutral-200 bg-white text-sm"><PiBugBeetleFill className="text-2xl" />ホーム</li>
        <li className="flex flex-col gap-1 items-center justify-center flex-1 pt-2 pb-1 border-t border-r border-neutral-200 bg-white text-sm"><FaList className="text-2xl" />生体一覧</li>
        <li className="flex flex-col gap-1 items-center justify-center flex-1 pt-2 pb-1 border-t border-r border-neutral-200 bg-white text-sm"><FaVenusMars className="text-2xl" />繁殖管理</li>
        {/* <li className="flex flex-col gap-1 items-center justify-center flex-1 pt-2 pb-1 border-t border-r border-neutral-200 bg-white text-sm"><FaPlusCircle className="text-2xl" />生体追加</li> */}
        <li className="flex flex-col gap-1 items-center justify-center flex-1 pt-2 pb-1 border-t border-neutral-200 bg-white text-sm"><IoSettingsSharp className="text-2xl" />設定</li>
      </ul>
    </nav>
  );
}
