#include <deque>
#include <iostream>

int main() {
    std::deque<int> values{2};
    values.push_front(1);
    values.push_back(3);
    std::cout << values[0] << ' ' << values[1] << ' ' << values[2] << '\n';
}
