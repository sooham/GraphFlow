﻿#pragma strict

import UnityEngine.Audio;
/* Attach to player gameObject
 *
 * This script allows the player to traverse the LevelGraph object as though it is traversing
 * a linked list. A level graph object is a Node containing a) nothing b) another node
 *
 * traversal forwards happens by changing the parent of the player object to the destination node
 * and lerping the player's local position to zero.
 *
 * The player must always be a child of a node object in the LevelGraph object
 */


var movementTime : float = 0.5f;			// The time to conduct a move
var blockedSound : AudioClip;				// The sound to play when blocked
var pickupSound : AudioClip;				// The sound to play when picking up trash
var errorSound : AudioClip;					// The sound to play when there are no objects to pickup
var trees : GameObject[];                    // A list of tree objects we can spawn
/* Compass directions
 * North is the direction towards the robot arm and the gantry
 */

public var playerFacing : String = "N";	// The direction the player is facing according to compass "NSEW"


//#################### MOVEMENT FUNCTIONS #########################

function movePlayer() {
	/* To be used after the player has changed parent in the LevelGraph
	 *
	 * Lerps the player over movement time from current position to (0, 0, 0) relative to new position.
	 */

	var startPos : Vector3 = transform.localPosition;	// get localPosition
	var movingStartTime : float = Time.time;
	var timeDiff : float = 0f;

	while (timeDiff < movementTime) {
		timeDiff = Time.time - movingStartTime;
		transform.localPosition = Vector3.Lerp(startPos, Vector3.zero, timeDiff / movementTime);
		yield;
	}
}

public function moveOneUnit() {
	/* move to the next / previous node if available and player is facing correct direction
	 * We use naming schema as follows to understand the position of node relative to parents
	 *
	 * Called by the programExecuter when it see the forward button
	 *
	 * NodeE - node going eastwards
	 * NodeW - node going westwards
	 * NodeN - node going northwards (towards robot arm)
	 * There are no such things as south nodes - they will not work with this movement method
	 *
	 * NOTE: THIS WILL NOT WORK WORK WITH GRAPHS, ONLY WITH TREES, make a graph data type for graph
	 */
	var currentNode : Transform = transform.parent;
	var blocked : boolean = true;

	switch (playerFacing) {
		case "S":
			if (currentNode.name == "NodeN" && currentNode.parent.name == "NodeN") {
				blocked = false;
				transform.SetParent(currentNode.parent, true);
			}
			break;
		case "E":
			// here if we are going up or down the linked list / tree is ambiguous
			if (currentNode.name == "NodeW") {
				blocked = false;
				transform.SetParent(currentNode.parent, true);
			} else if (currentNode.Find("NodeE")) {
				// move to that
				blocked = false;
				transform.SetParent(currentNode.Find("NodeE"), true);
			}
			break;
		case "W":
			// here if we are going up or down the linked list / tree is ambiguous
			if (currentNode.name == "NodeE") {
				blocked = false;
				transform.SetParent(currentNode.parent, true);
			} else if (currentNode.Find("NodeW")) {
				// move to that
				blocked = false;
				transform.SetParent(currentNode.Find("NodeW"), true);
			}
			break;
		default: // N
			if (currentNode.Find("NodeN")) {
				blocked = false;
				transform.SetParent(currentNode.Find("NodeN"), true);
			}
			break;
	}

	// play blocked sound if there is no way to go
	if (blocked) {
		AudioSource.PlayClipAtPoint(blockedSound, Vector3.zero, 1.0f);
	} else {
		// move and update current node
		movePlayer();
	}

}

function Turn(angle : float) {
	/* Helper function
	 * Turns the player by angle degrees relative to the parent
	 */
	var curEuler = transform.localEulerAngles;
	var newAngle = curEuler.y + angle;
	var rotationStartTime = Time.time;
	var timeDiff = 0f;
	while (timeDiff < movementTime) {
		timeDiff = Time.time - rotationStartTime;
		curEuler.y = Mathf.MoveTowards(curEuler.y, newAngle, 50 * timeDiff / movementTime);
		transform.eulerAngles = curEuler;
		yield;
	}
}

public function TurnLeft() {
	/* Turn the player -90 degrees (from North to West) and moves the player one unit
	 * This function is called by program executer when it sees the turnleft sign
	 */
	playerFacing = (playerFacing == "N") ? "W": (playerFacing == "W" ? "S" : (playerFacing == "S" ? "E" : "N"));
	Turn(-90.0f);
    moveOneUnit();
}

public function TurnRight() {
	/* Turn the player 90 degrees (from North to East) and moves the player one unit
	 * This function is called by program executer when it sees the turnright sign
	 */
	playerFacing = (playerFacing == "N") ? "E": (playerFacing == "E" ? "S" : (playerFacing == "S" ? "W" : "N"));
	Turn(90.0f);
    moveOneUnit();
}

public function cleanNode() {
	/* Makes the player inspect the current node
	 * This function is called by program executer when it sees the clean sign
	 *
	 * all items to be deleted from the node must be tagged "Trash"
     * cleaning a node with a star is supported but will be removed soon
	 */

	 // get the parent Node
	 var playErrorSound : boolean = true;
	 var currentNode : Transform = transform.parent;
	 // go through the children of the node player is currently on, looking for object like stars and trash
	 for (var child : Transform in currentNode) {
	 	switch (child.tag) {
	 		case "Trash":
	 			// delete the item
	 			playErrorSound = false;
	 			AudioSource.PlayClipAtPoint(pickupSound, transform.position, 0.5f);
	 			Destroy(child.gameObject);
	 			break;
	 		case "Star":
	 			// Level finished
	 			// play star animation, which is enabled by SetActive the child's sub gameobject
	 			// sound plays automatically
	 			child.GetChild(1).gameObject.SetActive(true);
	 			Destroy(child.GetChild(0).gameObject);
	 			break;
	 		default:
	 			break;
	 	}
	 }

	 if (playErrorSound) {
	 	AudioSource.PlayClipAtPoint(errorSound, transform.position, 0.5f);
	 }
}

public function plantNode() {
    /* Inserts a random plant from a list of plants onto a node
     * Cannot plant trees on currently occupied nodes
     */
    // Get the current node the player is on
    var currentNode : Transform = transform.parent;
    for (var child: Transform in currentNode) {
        if (child.tag == "Trash" || child.tag == "Tree") {
            AudioSource.PlayClipAtPoint(errorSound, transform.position, 0.5f);
            return;
        }
    }
    // no trash on the node, plant tree
    var tree = trees[Mathf.FloorToInt(Random.Range(0.0f,trees.length - 0.01))];
    var treeCopy = Instantiate(tree, transform.position, tree.transform.rotation) as GameObject;
    treeCopy.name = tree.name;
    treeCopy.transform.SetParent(currentNode);
}
