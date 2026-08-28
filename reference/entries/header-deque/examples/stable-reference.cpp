#include <deque>
#include <iostream>

int main() {
    std::deque<int> values{20, 30};
    int& kept = values.front();

    values.push_front(10);
    values.push_back(40);

    std::cout << kept << ' ' << values.size() << '\n';
}
