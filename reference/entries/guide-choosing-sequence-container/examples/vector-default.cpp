#include <array>
#include <deque>
#include <iostream>
#include <vector>

int main() {
    const std::array<int, 3> coordinates{1, 2, 3}; // Fixed size.
    const std::vector<int> batches{4, 5, 6};       // Grows at the back.

    std::deque<int> tasks{20, 30}; // Grows at both ends.
    tasks.push_front(10);
    tasks.push_back(40);

    const int coordinate_sum =
        coordinates[0] + coordinates[1] + coordinates[2];
    std::cout << coordinate_sum << " / " << batches.size() << " / "
              << tasks.front() << ' ' << tasks.back() << '\n';
}
