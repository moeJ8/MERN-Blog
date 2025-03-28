import { Button } from "flowbite-react";

export default function CallToAction() {
  return (
    <div className="flex flex-col sm:flex-row p-3 border border-teal-500 justify-center items-center rounded-tl-3xl rounded-br-3xl text-center">
      <div className="flex-1 justify-center flex flex-col">
        <h2 className="text-2xl">
            Want also to buy a chicken?
        </h2>
        <p className="text-gray-500 my-2">
            Checkout these recourses with some checkin you might like
        </p>
        <Button gradientDuoTone="purpleToPink" className="round-tl-xl rounded-bl-none">
            <a href="https://en.wikipedia.org/wiki/Chicken" target="_blank" rel="noopener noreferrer">
            Learn More
            </a>

        </Button>
      </div>
      <div className="p-7 flex-1">
        <img src="https://cdn.britannica.com/18/137318-050-29F7072E/rooster-Rhode-Island-Red-roosters-chicken-domestication.jpg" />
      </div>
    </div>
  )
}
