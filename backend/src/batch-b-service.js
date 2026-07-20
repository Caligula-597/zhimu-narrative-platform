import { query } from "./db.js";
import {
  listRoomSuspicionsForHost,
  upsertPlayerSuspicion
} from "./player-suspicions.js";
import { listRoomSegmentRemedies } from "./segment-remedies.js";
import {
  listRoomTestimoniesForHost,
  reviewTestimony
} from "./testimonies.js";

export function savePlayerSuspicion(input) {
  return upsertPlayerSuspicion(query, input);
}

export function getRoomTestimoniesForHost(roomId) {
  return listRoomTestimoniesForHost(query, roomId);
}

export function saveTestimonyReview(input) {
  return reviewTestimony(query, input);
}

export function getRoomSuspicionsForHost(roomId) {
  return listRoomSuspicionsForHost(query, roomId);
}

export function getRoomSegmentRemedies(roomId, segmentKey) {
  return listRoomSegmentRemedies(roomId, segmentKey);
}
