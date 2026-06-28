import { FaPlusCircle, FaList } from "react-icons/fa";
import { BsUpcScan } from "react-icons/bs";
import { LuNotebookText } from "react-icons/lu";
import { TbWood } from "react-icons/tb";

import LinkToListBtn from "@/components/ui/LinkToListBtn";
import WithIconBtn from "@/components/ui/WithIconBtn";

import Image from "next/image";
import ContentBox from "@/components/ui/ContentBox";


export default function Home() {
  return (
    <div className="flex flex-col gap-4">
      {/* <WithIconBtn className="bg-neutral-700">
        <BsUpcScan className="text-3xl" />OCR（IDスキャン）
      </WithIconBtn> */}

      {/* <ul className="grid grid-cols-2 gap-2">
        <li className="flex flex-col gap-1 items-center justify-center py-4 rounded-md border border-neutral-200 bg-white shadow-sm text-lg"><FaPlusCircle className="text-3xl" />生体追加</li>
        <li className="flex flex-col gap-1 items-center justify-center py-4 rounded-md border border-neutral-200 bg-white shadow-sm text-lg"><FaList className="text-3xl" />生体一覧</li>
        <li className="flex gap-2 items-center justify-center col-span-2 p-10 py-6 rounded-md border border-neutral-200 bg-white shadow-sm text-lg"><BsUpcScan className="text-3xl" />OCR（IDスキャン）</li>
      </ul> */}

      <ContentBox>
        <h2 className="flex items-center gap-1 border-b border-neutral-300 mb-2"><LuNotebookText />飼育メモ</h2>
        <div className="flex flex-col gap-1 text-sm max-h-29 overflow-y-auto palt">
          <p>【DHH-001】エサ交換の目安時期が近づいています。</p>
          <p>【DHH-002】エサ交換の目安時期が近づいています。</p>
          <p>【DHH-003】エサ交換の目安時期が近づいています。</p>
          <p>【DHH-004】エサ交換の目安時期が近づいています。</p>
          <p>【DHH-005】エサ交換の目安時期が近づいています。</p>
          <p>【DHH-006】エサ交換の目安時期が近づいています。</p>
          <p>【DHH-007】エサ交換の目安時期が近づいています。</p>
        </div>
      </ContentBox>

      <ContentBox>
        <h2 className="flex items-center gap-1 border-b border-neutral-300 mb-2"><FaList />飼育中の生体一覧</h2>
        <div className="grid grid-cols-2 gap-2">
          <LinkToListBtn>
            <Image
              className="scale-x-110"
              src="/img/beetle_icon.png"
              width="50"
              height="50"
              alt="カブトムシ"
            />
            <p className="text-center flex-1">成虫<span className="block text-xs">(カブトムシ)</span></p>
            <p className="w-full border-t border-neutral-300 text-center pt-1 text-lg font-bold">0<span className="text-sm indivne-block ml-0.5">匹</span></p>
          </LinkToListBtn>

          <LinkToListBtn>
            <Image
              className=""
              src="/img/larva_icon.png"
              width="56"
              height="56"
              alt="幼虫"
            />
            <p className="text-center flex-1">幼虫<span className="block text-xs">(カブトムシ)</span></p>
            <p className="w-full border-t border-neutral-300 text-center pt-1 text-lg font-bold">21<span className="text-sm indivne-block ml-0.5">匹</span></p>
          </LinkToListBtn>

          <LinkToListBtn>
            <Image
              className=""
              src="/img/stag_beetle_icon.png"
              width="56"
              height="56"
              alt="クワガタ"
            />
            <p className="text-center flex-1">成虫<span className="block text-xs">(クワガタ)</span></p>
            <p className="w-full border-t border-neutral-300 text-center pt-1 text-lg font-bold">17<span className="text-sm indivne-block ml-0.5">匹</span></p>
          </LinkToListBtn>

          <LinkToListBtn>
            <Image
              className=""
              src="/img/larva_icon.png"
              width="56"
              height="56"
              alt="幼虫"
            />
            <p className="text-center flex-1">幼虫<span className="block text-xs">(クワガタ)</span></p>
            <p className="w-full border-t border-neutral-300 text-center pt-1 text-lg font-bold">36<span className="text-sm indivne-block ml-0.5">匹</span></p>
          </LinkToListBtn>

          <hr className="col-span-2 w-full text-neutral-300" />

          <WithIconBtn btnColor="bg-green-700">
            <FaPlusCircle className="text-xl" />飼育個体を追加する
          </WithIconBtn>

        </div>
      </ContentBox>

      <ContentBox>
        <h2 className="flex items-center gap-1 border-b border-neutral-300 mb-2"><TbWood />産卵セット中の生体一覧</h2>
        <div>
          <p className="py-4 w-full text-center text-sm">現在産卵セットを組んでいる生体はいません。</p>
        </div>
      </ContentBox>
    </div>
  );
}
