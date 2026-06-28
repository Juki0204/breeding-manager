import { BsUpcScan } from "react-icons/bs";
import { FaList, FaPlusCircle } from "react-icons/fa";
import { IoSettingsSharp } from "react-icons/io5";
import { TbWood } from "react-icons/tb";


export default function GlobalNav() {
  return (
    <nav className="fixed bottom-0 w-full left-0">
      <ul className="flex">
        <li className="flex flex-col gap-1 items-center justify-center flex-1 pt-2 pb-1 border-t border-r border-neutral-200 bg-white text-sm"><FaList className="text-2xl" />生体一覧</li>
        <li className="flex flex-col gap-1 items-center justify-center flex-1 pt-2 pb-1 border-t border-r border-neutral-200 bg-white text-sm"><TbWood className="text-2xl" />産卵管理</li>
        {/* <li className="flex flex-col gap-1 items-center justify-center flex-1 pt-2 pb-1 border-t border-r border-neutral-200 bg-white text-sm"><FaPlusCircle className="text-2xl" />生体追加</li> */}
        <li className="flex flex-col gap-1 items-center justify-center flex-1 pt-2 pb-1 border-t border-neutral-200 bg-white text-sm"><IoSettingsSharp className="text-2xl" />設定</li>
      </ul>
    </nav>
  );
}
