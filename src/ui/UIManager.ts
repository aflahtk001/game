export class UIManager {
  private container: HTMLDivElement;
  private interactionPrompt: HTMLDivElement;
  private hud: HTMLDivElement;
  private speedElement: HTMLSpanElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.position = 'absolute';
    this.container.style.top = '0';
    this.container.style.left = '0';
    this.container.style.width = '100%';
    this.container.style.height = '100%';
    this.container.style.pointerEvents = 'none';
    this.container.style.fontFamily = 'Arial, sans-serif';
    document.body.appendChild(this.container);

    // Interaction Prompt
    this.interactionPrompt = document.createElement('div');
    this.interactionPrompt.style.position = 'absolute';
    this.interactionPrompt.style.bottom = '20%';
    this.interactionPrompt.style.left = '50%';
    this.interactionPrompt.style.transform = 'translateX(-50%)';
    this.interactionPrompt.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.interactionPrompt.style.color = 'white';
    this.interactionPrompt.style.padding = '10px 20px';
    this.interactionPrompt.style.borderRadius = '5px';
    this.interactionPrompt.style.fontSize = '24px';
    this.interactionPrompt.style.display = 'none';
    this.container.appendChild(this.interactionPrompt);

    // HUD
    this.hud = document.createElement('div');
    this.hud.style.position = 'absolute';
    this.hud.style.bottom = '30px';
    this.hud.style.right = '30px';
    this.hud.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.hud.style.color = 'white';
    this.hud.style.padding = '15px';
    this.hud.style.borderRadius = '8px';
    this.hud.style.display = 'none';
    this.hud.style.fontSize = '20px';
    
    const speedLabel = document.createElement('div');
    speedLabel.innerText = 'Speed: ';
    this.speedElement = document.createElement('span');
    this.speedElement.innerText = '0';
    
    speedLabel.appendChild(this.speedElement);
    speedLabel.appendChild(document.createTextNode(' mph'));
    this.hud.appendChild(speedLabel);

    const exitHint = document.createElement('div');
    exitHint.innerText = '[E] to Exit';
    exitHint.style.fontSize = '14px';
    exitHint.style.marginTop = '8px';
    exitHint.style.color = '#aaa';
    this.hud.appendChild(exitHint);

    this.container.appendChild(this.hud);
  }

  public showInteractionPrompt(text: string) {
    this.interactionPrompt.innerText = text;
    this.interactionPrompt.style.display = 'block';
  }

  public hideInteractionPrompt() {
    this.interactionPrompt.style.display = 'none';
  }

  public setHUDVisible(visible: boolean) {
    this.hud.style.display = visible ? 'block' : 'none';
  }

  public updateHUD(speed: number) {
    const clampedSpeed = Math.abs(speed) < 0.5 ? 0 : speed;
    const mph = Math.abs(clampedSpeed) * 2.237;
    this.speedElement.innerText = Math.round(mph).toString();
  }
}
