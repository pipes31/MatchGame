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
    "src/assets/image/empty.png",
  ];
  let candies: HTMLImageElement[] = [];
  let imageDragged: string;
  let imageReplaced: string;
  let candyDraggedId: number;
  let candyReplacedId: number;
  let idDragged: number;
  let idReplaced: number;
  let id: number;

  const mainTitulo = document.querySelector(".main-titulo") as HTMLElement;
  const timer = document.querySelector("#timer") as HTMLElement;
  const score = document.querySelector("#score-text") as HTMLElement;
  const btnReinicio = document.querySelector(".btn-reinicio") as HTMLElement;

  //Setting Reset Button Behavior
  if (btnReinicio) {
    btnReinicio.addEventListener("click", () => {
      if (!isActive) {
        btnReinicio.innerHTML = "Reiniciar";
        isActive = true;

        init();
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

  const getID = (candyId: number): number => {
    if (candyId > 10 && candyId < 18) id = candyId - 11;
    else if (candyId > 20 && candyId < 28) id = candyId - 14;
    else if (candyId > 30 && candyId < 38) id = candyId - 17;
    else if (candyId > 40 && candyId < 48) id = candyId - 20;
    else if (candyId > 50 && candyId < 58) id = candyId - 23;
    else if (candyId > 60 && candyId < 68) id = candyId - 26;
    else if (candyId > 70 && candyId < 78) id = candyId - 29;
    else id = -1;

    return id;
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

  //setting init function
  const init = () => {
    animate(mainTitulo);
    for (let i = 1; i < 8 * 8; i++) {
      for (let j = 1; j < 8; j++) {
        candyGenerator(i, j);
      }
    }

    //setting Countdown
    const countdown = new CountdownTimer(2, 0);
    setInterval(() => {
      const timeRemaining = countdown.getTimeRemaining();
      if (timeRemaining.minutes === 0 && timeRemaining.seconds === 0) {
        timer.textContent = "Times Up!";
        animate(timer, "#7A0080");
      } else if (timeRemaining.seconds < 10) {
        timer.textContent =
          "0" + timeRemaining.minutes + ":0" + timeRemaining.seconds;
      } else
        timer.textContent =
          "0" + timeRemaining.minutes + ":" + timeRemaining.seconds;
    }, 1000);

    //Draggin functions
    function dragstart(this: any) {
      imageDragged = this.src;
      candyDraggedId = parseInt(this.id);
    }
    const dragenter = (e: Event) => {
      e.preventDefault();
    };
    const dragover = (e: Event) => {
      e.preventDefault();
    };
    function dragleave(e: Event) {
      e.preventDefault();
      // if (this.src === "src/assets/image/empty.png") {
      //   return console.log(this.src);
      // } else this.src = "src/assets/image/empty.png";
    }

    function drop(this: any) {
      imageReplaced = this.src;
      candyReplacedId = parseInt(this.id);
      this.src = imageDragged;

      idDragged = getID(candyDraggedId);
      idReplaced = getID(candyReplacedId);
      candies[idDragged].src = imageReplaced;
    }

    function dragend(this: any) {
      //Move Conditional

      let movementAllowed: number[] = [
        candyDraggedId + 1,
        candyDraggedId - 1,
        candyDraggedId + 10,
        candyDraggedId - 10,
      ];
      let isMovementAllowed: boolean =
        movementAllowed.includes(candyReplacedId);

      if (candyReplacedId && !isMovementAllowed) {
        candies[idDragged].src = imageDragged;
        candies[idReplaced].src = imageReplaced;
        console.log(
          "move Not Allowed " + (candyReplacedId && isMovementAllowed)
        );
      }
    }

    const checkRows = () => {
      for (let i = 0; i < 47; i++) {
        let rows: number[] = [i, i + 7, i + 7 * 2];
        const isEmpty: string = candies[i].src === images[4];
      }
    };
    candies.forEach((candy) => candy.addEventListener("dragstart", dragstart));
    candies.forEach((candy) => candy.addEventListener("dragenter", dragenter));
    candies.forEach((candy) => candy.addEventListener("dragover", dragover));
    candies.forEach((candy) => candy.addEventListener("dragleave", dragleave));
    candies.forEach((candy) => candy.addEventListener("dragend", dragend));
    candies.forEach((candy) => candy.addEventListener("drop", drop));
  };
});
