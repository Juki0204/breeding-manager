import { IoMdMale, IoMdFemale } from "react-icons/io";




export default function ShowDetails() {
  return (
    <div className="grid grid-cols-12 gap-1">

      <div className="detail-bg-image absolute top-0 left-0 w-full opacity-20 -z-1">
        <img
          className="w-full h-auto"
          src="/img/herakuresu00.jpg"
          alt="ヘラクレスオオカブト"
        />
      </div>

      <div className="col-span-12 grid place-content-center">
        <img
          className="w-40 aspect-square object-cover rounded-full"
          src="/img/herakuresu00.jpg"
          alt="ヘラクレスオオカブト"
        />
      </div>

      <div className="col-span-12 text-sm font-bold">DHH-0001</div>

      <h3 className="col-span-12 flex gap-1 items-center pt-1 text-lg font-bold">
        <IoMdMale className="text-blue-600" />
        ヘラクレスオオカブト
      </h3>
      <div className="col-span-12 flex gap-1 items-center pb-3 font-normal text-xs">
        亜種：ヘラクレス・ヘラクレス
      </div>

      <div className="col-span-12 flex gap-1 items-center pb-1 font-normal text-sm border-b border-neutral-200">
        <span className="py-px px-2 rounded-sm bg-green-700 text-white">産地</span>
        グアドループ
      </div>

      <div className="col-span-12 grid grid-cols-2 gap-1 items-center pb-1 font-normal text-sm border-b border-neutral-200">
        <div className="flex gap-1 items-center">
          <span className="py-px px-2 rounded-sm bg-green-700 text-white">状態</span>
          成虫
        </div>

        <div className="flex gap-1 items-center">
          <span className="py-px px-2 rounded-sm bg-green-700 text-white">サイズ</span>
          150mm
        </div>
      </div>

      <div className="col-span-12 grid grid-cols-2 gap-1 items-center pb-1 font-normal text-sm">
        <div className="flex gap-1 items-center">
          <span className="py-px px-2 rounded-sm bg-green-700 text-white">血統</span>
          -
        </div>

        <div className="flex gap-1 items-center">
          <span className="py-px px-2 rounded-sm bg-green-700 text-white">羽化日</span>
          2026-04-26
        </div>
      </div>

      <div className="col-span-12 text-sm">
        <textarea rows={4} className="w-full py-1 px-1.5 rounded-md border border-neutral-300" placeholder="メモを入力"></textarea>
      </div>

      <div className="col-span-12 py-2 text-center rounded-md bg-blue-700 tracking-widest text-white">詳細</div>
    </div>
  )
}
