type PointXY = { x: number, y: number }
// m = (y_2 - y_1) / (x_2 - x_1)
// d = sqrt((x_2 - x_1)^2 + (y_2 - y_1)^2)

/**
 * https://stackoverflow.com/questions/21191875/calculate-the-point-of-intersection-of-circle-and-line-through-the-center
 * Finds the intersection between a circles border 
 * and a line from the origin to the otherLineEndPoint.
 * @param  {PointXY} origin            - center of the circle and start of the line
 * @param  {number} radius            - radius of the circle
 * @param  {PointXY} otherLineEndPoint - end of the line
 * @return {PointXY}                   - point of the intersection
 */
export function findWhereRayIntersectsCircle([origin, otherLineEndPoint]: [PointXY, PointXY], radius: number): PointXY {
    let v = new Vector(otherLineEndPoint).subtract(new Vector(origin));
    const lineLength = v.length();    
    if (lineLength === 0) throw new Error("Length has to be positive");
    v = v.normalize();
    return new Vector(origin).add(v.multiplyScalar(radius))
}

class Vector {
    public x!: number
    public y!: number

    public constructor({x, y}: PointXY) {
        this.x = x ?? 0
        this.y = y ?? 0
    }

    public add(vector: Vector) {
        return new Vector({ x: this.x + vector.x, y: this.y + vector.y })
    }

    public subtract(vector: Vector) {
        return new Vector({ x: this.x - vector.x, y: this.y - vector.y })
    }

    public multiply(vector: Vector) {
        return new Vector({ x: this.x * vector.x, y: this.y * vector.y })
    }

    public multiplyScalar(scalar: number) {
        return new Vector({ x: this.x * scalar, y: this.y * scalar })
    }

    public divide(vector: Vector) {
        return new Vector({ x: this.x / vector.x, y: this.y / vector.y })
    }

    public divideScalar(scalar: number) {
        return new Vector({ x: this.x / scalar, y: this.y / scalar })
    }

    public length() {
        return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2))
    }

    public normalize() {
        return this.divideScalar(this.length())
    }
}

// line intercept math by Paul Bourke http://paulbourke.net/geometry/pointlineplane/
// Determine the intersection point of two line segments
// Return FALSE if the lines don't intersect
export function intersect([p1, p2]: [PointXY, PointXY], [p3, p4]: [PointXY, PointXY]): PointXY | undefined {
    const { x: x1, y: y1 } = p1
    const { x: x2, y: y2 } = p2
    const { x: x3, y: y3 } = p3
    const { x: x4, y: y4 } = p4

    // Check if none of the lines are of length 0
    if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
        return undefined
    }

    const denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1))

    // Lines are parallel
    if (denominator === 0) {
        return undefined
    }

    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator

    // is the intersection along the segments
    if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
        return undefined
    }

    const x = x1 + ua * (x2 - x1)
    const y = y1 + ua * (y2 - y1)

    return {x, y}
}
// Found another good one at https://www.geeksforgeeks.org/check-if-two-given-line-segments-intersect
// but it only gives you true or false, and also isn't as compact as this.


