import { Socket } from 'socket.io';
import { ConnectedSocket, NspParam, OnConnect, OnDisconnect } from 'socket.io-ts-controllers';
import { SocketController } from 'socket.io-ts-controllers';
import { ContainerStatus } from 'src/Services/Model/ContainerStatus';
import { Logger } from 'src/Utils/Logger.service';
import dockerService from "../../Services/Docker.service";

@SocketController("/status/:name")
export class StatusController {

  private readonly _logger = new Logger(this)
  
  @OnConnect()
  connect(@ConnectedSocket() socket: Socket, @NspParam("name") name: string) {
    this._logger.log("New connexion");
    try {
      dockerService.listenContainerStatus(name, (status) => this._onStatus(socket, status));
    } catch (e) {
      socket.emit("error", 400, "Bad Request");
      socket.disconnect(true);
    }
  }

  @OnDisconnect()
  disconnect(@ConnectedSocket() socket: Socket) {
    this._logger.log("Connexion stopped");
  }

  private _onStatus(socket: Socket, status: ContainerStatus) {
    socket.emit("status", status.toString());
  }

}