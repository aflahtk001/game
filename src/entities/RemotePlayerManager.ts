import * as THREE from 'three';
import { RemotePlayer } from './RemotePlayer';
import type { NetworkManager } from '../network/NetworkManager';
import type { StateUpdatePayload } from '../network/networkTypes';

export class RemotePlayerManager {
  private scene: THREE.Scene;
  private network: NetworkManager;
  private vehicleManager: import('./VehicleManager').VehicleManager;
  private players: Map<string, RemotePlayer> = new Map();

  constructor(scene: THREE.Scene, network: NetworkManager, vehicleManager: import('./VehicleManager').VehicleManager) {
    this.scene = scene;
    this.network = network;
    this.vehicleManager = vehicleManager;

    this.bindNetworkEvents();
  }

  private bindNetworkEvents() {
    this.network.on('world_joined', (payload) => {
      this.clearPlayers();
      if (payload.activePlayers) {
        for (const remote of payload.activePlayers) {
          if (remote.id !== this.network.localPlayer?.id) {
            this.spawnPlayer(remote.id, remote.displayName);
          }
        }
      }
    });

    this.network.on('player_joined', (payload) => {
      // Don't spawn self
      if (this.network.localPlayer?.id === payload.player.id) return;
      this.spawnPlayer(payload.player.id, payload.player.displayName);
    });

    this.network.on('player_left', (payload) => {
      this.removePlayer(payload.playerId);
    });

    this.network.on('session_left', () => {
      this.clearPlayers();
    });

    this.network.on('update_state', (payload: StateUpdatePayload) => {
      for (const [playerId, state] of Object.entries(payload.players)) {
        if (playerId === this.network.localPlayer?.id) continue;
        
        const player = this.players.get(playerId);
        if (player) {
          player.setTargetState(state);
        } else {
          // If we receive state for a player we don't have, spawn them
          // (Usually shouldn't happen unless they joined before we fully initialized)
          this.spawnPlayer(playerId, `Player_${playerId.substring(0,4)}`);
          this.players.get(playerId)?.setTargetState(state);
        }
      }
    });
  }

  private spawnPlayer(playerId: string, displayName: string) {
    if (this.players.has(playerId)) return;
    console.log(`[RemotePlayerManager] Spawning remote player: ${displayName}`);
    const rp = new RemotePlayer(this.scene, playerId, displayName, this.vehicleManager);
    this.players.set(playerId, rp);
  }

  private removePlayer(playerId: string) {
    const rp = this.players.get(playerId);
    if (rp) {
      console.log(`[RemotePlayerManager] Removing remote player: ${rp.displayName}`);
      rp.destroy();
      this.players.delete(playerId);
    }
  }

  private clearPlayers() {
    for (const rp of this.players.values()) {
      rp.destroy();
    }
    this.players.clear();
  }

  public getPlayer(playerId: string): RemotePlayer | undefined {
    return this.players.get(playerId);
  }

  public getAllPlayers(): Map<string, RemotePlayer> {
    return this.players;
  }

  public setPlayerSpeaking(playerId: string, isSpeaking: boolean) {
    const rp = this.players.get(playerId);
    if (rp) {
      rp.updateNameTag(isSpeaking, undefined);
    }
  }

  public update(delta: number) {
    for (const rp of this.players.values()) {
      rp.update(delta);
    }
  }
}
