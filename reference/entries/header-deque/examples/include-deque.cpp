#include <deque>
#include <iostream>

int main() {
    std::deque<int> values{2};
    values.push_front(1);
    values.push_back(3);
    std::cout << values.front() << ' ' << values.back() << '\n';
}
