document.addEventListener("DOMContentLoaded", () => {
  // Inicio -------------------------------------------
  let isActive: boolean = false;

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

  const candyGenerator = (i: number) => {
    let randomNumber: number = Math.floor(Math.random() * 4 + 1);
    const img = document.createElement("img");

    img.src = "src/assets/image/" + randomNumber + ".png";

    const column = document.getElementById("col-" + i);

    if (column) {
      img.classList.add("elemento");
      img.setAttribute("id", randomNumber.toString());
      console.log(img.id);

      column.appendChild(img);
    }
  };

  const iniciar = () => {
    animacion();
    for (let i = 1; i < 8; i++) {
      for (let j = 1; j < 8; j++) candyGenerator(i);
    }
  };

  // Add draggable and droppable behavior
  // const elementos = document.querySelectorAll(".elemento");
  // elementos.forEach((element) => {
  //   element.draggable = true;
  // });

  //   // Temporizador
  //   const Temporizador = new (function () {
  //     let countdown: HTMLElement;
  //     let incrementTime: number = 70;
  //     let currentTime: number = 12000;

  //     const updateTimer = () => {
  //       animacion();

  //       countdown.innerHTML = formatTime(currentTime);

  //       if (currentTime === 0) {
  //         Temporizador.Timer.stop();
  //         timerComplete();
  //         return;
  //       }

  //       currentTime -= incrementTime / 10;

  //       if (currentTime < 0) {
  //         currentTime = 0;
  //       }
  //     };

  //     const timerComplete = () => {
  //       alert("Juego Terminado");
  //     };

  //     const init = () => {
  //       countdown = document.getElementById("timer") as HTMLElement;

  //       Temporizador.Timer = setInterval(updateTimer, incrementTime) as any;
  //     };

  //     this.resetCountdown = () => {
  //       const newTime = 12000;
  //       if (newTime > 0) {
  //         currentTime = newTime;
  //       }
  //       this.Timer.stop();
  //     };

  //     init();
  //   })();
  // });

  // Function for animation
  const animacion = () => {
    const mainTitulo = document.querySelector(".main-titulo") as HTMLElement;
    let isAnimationActive = true;

    const changeColor = () => {
      mainTitulo.style.transition = "color 2s";
      mainTitulo.style.color = "cyan";

      setTimeout(() => {
        mainTitulo.style.color = "#DCFF0E";
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

  // function pad(number: number, length: number) {
  //   let str: string = "" + number;
  //   while (str.length < length) {
  //     str = "0" + str;
  //   }
  //   return str;
  // }

  // function formatTime(time: number) {
  //   const min: number = Math.floor(time / 6000);
  //   const sec: number = Math.floor(time / 100) - min * 60;

  //   return (min > 0 ? pad(min, 2) : "00") + ":" + pad(sec, 2);
});
