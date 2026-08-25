#include <deque>
#include <iostream>

int main() {
    std::deque<int> jobs{20, 30};
    jobs.push_front(10);
    jobs.push_back(40);
    jobs.pop_front();

    std::cout << jobs.front() << ' ' << jobs.back() << ' ' << jobs.size()
              << '\n';
}
