import { CountdownTimer } from "./scripts/timer";

document.addEventListener("DOMContentLoaded", () => {
  // Inicio -------------------------------------------
  let isActive: boolean = false;
  const images: string[] = [
    "/image/1.webp",
    "/image/2.webp",
    "/image/3.webp",
    "/image/4.webp",
    "/image/empty.webp",
  ];
  let candies: HTMLImageElement[] = [];
  let imageDragged: string;
  let imageReplaced: string;
  let candyDraggedId: number;
  let candyReplacedId: number;
  let idDragged: number;
  let idReplaced: number;
  let id: number;
  let points: number = 0;
  let movements: number = 0;
  const limitTime = 120000;

  const mainTitulo = document.querySelector(".main-title") as HTMLElement;
  const timer = document.querySelector("#timer") as HTMLElement;
  const score = document.querySelector("#score-text") as HTMLElement;
  const btnStart = document.querySelector(".btn-start") as HTMLElement;
  const moveLabel = document.querySelector("#move-text") as HTMLElement;

  //Setting Reset Button Behavior
  if (btnStart) {
    btnStart.addEventListener("click", () => {
      if (!isActive) {
        btnStart.textContent = "Restart";
        isActive = true;
        init();
      } else {
        location.reload();
      }
    });
  }

  //Fuction to Generate Candy when the game starts
  const candyGenerator = (i: number, j: number) => {
    let randomImage: number = Math.floor(Math.random() * (images.length - 1));
    let candy = document.createElement("img");
    candy.src = images[randomImage];

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

  //Function to GetID use on Drop Function
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

  //Fuction to Check the matches for the rows
  const checkRows = () => {
    for (let i = 0; i < 35; i++) {
      const rows: number[] = [i, i + 7, i + 7 * 2];
      const colorSelected = candies[i].src;
      const isEmpty = candies[i].getAttribute("value") === "-1";

      if (
        !isEmpty &&
        rows.every((index) => candies[index].src === colorSelected)
      ) {
        points = points + 3;
        score.textContent = points.toString();
        rows.forEach((index) => {
          candies[index].src = images[4];
          candies[index].setAttribute("value", "-1");
        });
      }
    }
  };

  //Fuction to Check the matches for the Columns
  const checkColumns = () => {
    for (let i = 0; i < 47; i++) {
      const columns: number[] = [i, i + 1, i + 2];
      const exceptions: number[] = [7, 14, 21, 28, 35, 42];
      const colorSelected = candies[i].src;
      const isEmpty = candies[i].getAttribute("value") === "-1";

      let isAllowed = true;
      for (let j = 0; j < columns.length; j++) {
        if (exceptions.includes(columns[j || j - 1 || j - 2])) {
          isAllowed = false;

          break;
        }
      }
      if (
        !isEmpty &&
        isAllowed &&
        columns.every((index) => candies[index].src === colorSelected)
      ) {
        points = points + 3;
        score.textContent = points.toString();
        columns.forEach((index) => {
          candies[index].src = images[4];
          candies[index].setAttribute("value", "-1");
        });
      }
    }
  };

  //Fuction To move candies to the row below
  const moveCandyBelow = () => {
    for (let i = 0; i < candies.length; i++) {
      const isEmpty = candies[i].getAttribute("value") === "-1";
      let exceptions: number[] = [0, 7, 14, 21, 28, 35, 42];
      const isExcepted = exceptions.includes(i);
      if (isEmpty) {
        if (!isExcepted) {
          candies[i].src = candies[i - 1].src;
          candies[i].setAttribute("value", i.toString());
          candies[i - 1].src = images[4];
          candies[i - 1].setAttribute("value", "-1");
        } else {
          let randomImage = Math.floor(Math.random() * (images.length - 1));
          candies[i].src = images[randomImage];

          candies[i].setAttribute("value", i.toString());
        }
      }
    }
  };

  //setting init function
  const init = () => {
    animate(mainTitulo);
    for (let i = 1; i < 8; i++) {
      for (let j = 1; j < 8; j++) {
        candyGenerator(i, j);
      }
    }

    //Interval function to execute game's behavior
    const intervalId = setInterval(() => {
      checkRows();
      checkColumns();
      moveCandyBelow();
    }, 100);

    //Stop the Interval function when the time runs out
    setTimeout(() => {
      clearInterval(intervalId);
    }, limitTime);

    //calling the class CountdownTimer to creates the timer and setting different behaviours for a couple HTMLELEMENTS
    const countdown = new CountdownTimer(2, 0);
    setInterval(() => {
      const timeRemaining = countdown.getTimeRemaining();
      if (timeRemaining.minutes === 0 && timeRemaining.seconds === 0) {
        timer.textContent = "Times Up!";
        animate(timer, "#7A0080");
        for (let i = 0; i < candies.length; i++) {
          candies[i].setAttribute("draggable", "false");
        }
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
      movements += 1;
      moveLabel.textContent = movements.toString();

      if (candyReplacedId && !isMovementAllowed) {
        candies[idDragged].src = imageDragged;
        candies[idReplaced].src = imageReplaced;
        movements -= 1;
        moveLabel.textContent = movements.toString();
      }
    }

    candies.forEach((candy) => candy.addEventListener("dragstart", dragstart));
    candies.forEach((candy) => candy.addEventListener("dragenter", dragenter));
    candies.forEach((candy) => candy.addEventListener("dragover", dragover));
    candies.forEach((candy) => candy.addEventListener("dragleave", dragleave));
    candies.forEach((candy) => candy.addEventListener("dragend", dragend));
    candies.forEach((candy) => candy.addEventListener("drop", drop));
  };
});
