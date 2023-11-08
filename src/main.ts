// import anime from "animejs/lib/anime.es.js";
import { CountdownTimer } from "./scripts/timer";

document.addEventListener("DOMContentLoaded", () => {
  // Inicio -------------------------------------------
  let isActive: boolean = false;
  const images: string[] = [
    "src/assets/image/1.png",
    "src/assets/image/2.png",
    "src/assets/image/3.png",
    "src/assets/image/4.png",
  ];
  let candies: HTMLImageElement[] = [];
  let imageDragged: string;
  let imageReplaced: string;
  let candyDraggedId: number;
  let candyReplacedId: number;

  const mainTitulo = document.querySelector(".main-titulo") as HTMLElement;
  const timer = document.querySelector("#timer") as HTMLElement;

  const btnReinicio = document.querySelector(".btn-reinicio") as HTMLElement;

  //Setting Reset Button Behavior
  if (btnReinicio) {
    btnReinicio.addEventListener("click", () => {
      if (!isActive) {
        btnReinicio.innerHTML = "Reiniciar";
        isActive = true;

        iniciar();
      } else {
        location.reload();
      }
    });
  }

  //Evento para el botón mas (+)

  const candyGenerator = (i: number, j: number) => {
    let randomNumber: number = Math.floor(Math.random() * images.length);
    let candy = document.createElement("img");
    candy.src = images[randomNumber];

    const column = document.getElementById("col-" + i);

    if (column) {
      const value = i + "" + j;
      candy.classList.add("elemento");
      candy.setAttribute("draggable", "true");
      candy.setAttribute("value", value);
      candy.setAttribute("id", value);
      column.appendChild(candy);
      candies.push(candy);
    }
  };

  // Function to animate an HTMLElement
  const animate = (
    element: HTMLElement,
    primaryColor = "cyan",
    secondaryColor = "#DCFF0E"
  ) => {
    let isAnimationActive = true;

    const changeColor = () => {
      element.style.transition = "color 2s";
      element.style.color = primaryColor;
      setTimeout(() => {
        element.style.color = secondaryColor;
      }, 2000);
    };

    // Llama a la función cambiarColor inicialmente
    changeColor();

    // Configura la animación para que se repita cada 2 segundos
    const intervalId = setInterval(() => {
      if (!isAnimationActive) {
        clearInterval(intervalId); // Detiene la animación cuando animacionActiva sea false
      } else {
        changeColor();
      }
    }, 4000);
  };

  // const animationTest = () => {
  //   anime({
  //     targets: "div",
  //     translateX: 250,
  //     rotate: "1turn",
  //     backgroundColor: "#FFF",
  //     duration: 800,
  //   });
  // };

  const iniciar = () => {
    animate(mainTitulo);
    for (let i = 1; i < 8; i++) {
      for (let j = 1; j < 8; j++) {
        candyGenerator(i, j);
      }
    }

    //setting Countdown
    const countdown = new CountdownTimer(0, 10);
    setInterval(() => {
      const timeRemaining = countdown.getTimeRemaining();
      if (timeRemaining.minutes === 0 && timeRemaining.seconds === 0) {
        timer.textContent = "Times Up!";
        animate(timer, "#7A0080");
      } else
        timer.textContent = timeRemaining.minutes + ":" + timeRemaining.seconds;
    }, 1000);

    //Draggin functions
    function dragstart(this: any) {
      imageDragged = this.src;
      candyDraggedId = parseInt(this.id);
      console.log("dragging", imageDragged, candyDraggedId);
    }
    const dragenter = (e: Event) => {
      e.preventDefault();
    };
    const dragover = (e: Event) => {
      e.preventDefault();
    };
    function dragleave(this: any) {
      this.src;
    }
    function dragend(this: any) {
      console.log(imageReplaced);
    }
    function drop(this: any) {
      imageReplaced = this.src;
      this.src = imageDragged;
    }
    candies.forEach((candy) => candy.addEventListener("dragstart", dragstart));
    candies.forEach((candy) => candy.addEventListener("dragenter", dragenter));
    candies.forEach((candy) => candy.addEventListener("dragover", dragover));
    candies.forEach((candy) => candy.addEventListener("dragleave", dragleave));
    candies.forEach((candy) => candy.addEventListener("dragend", dragend));
    candies.forEach((candy) => candy.addEventListener("drop", drop));
  };
});
